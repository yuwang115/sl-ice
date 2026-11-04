/**
 * Main physics loop for the ice sheet model.
 *
 * Orchestrates all physics modules:
 * 1. Compute SMB
 * 2. Compute ocean melt
 * 3. Solve BP velocity
 * 4. Evolve ice thickness
 * 5. Update grounding line
 * 6. Evolve hydrology (if enabled)
 * 7. Detect game events
 */

import {
  DEFAULT_DX, DEFAULT_NZ, DEFAULT_DOMAIN_LENGTH, DEFAULT_DT,
  RHO_ICE, VOLUME_TO_SLE, H_MIN, LATERAL_DRAG_DEFAULT,
} from './constants';
import { solveBP, depthAverageVelocity, surfaceVelocity, basalVelocity } from './bp-solver';
import { computeSMB } from './smb';
import { computeOceanMelt } from './ocean-melt';
import { evolveThickness, applyCalving } from './ice-thickness';
import { applyCliffCalving } from './cliff-calving';
import {
  updateGroundingLine, computeSurfaceElevation, computeIceBase, computeIceVolume,
} from './grounding-line';
import {
  evolveHydrology, computeEffectivePressure, computeGroundedBasalMelt,
} from './hydrology';
import { invertDragFields } from './inversion';
import type {
  ModelState, ModelGrid, ScenarioConfig, UserParams,
  PhysicsStatePayload, GameEvent,
} from './types';

const FLOWLINE_WIDTH_METERS = 1000;
const GIGATONNES_PER_KM3_ICE = RHO_ICE * 1e-3;

/** Maximum allowed CFL number for stability */
const CFL_MAX = 0.8;

/** Minimum floating thickness (m) that counts as a buttressing ice shelf. */
const SHELF_MIN_THICKNESS = 50;

/** Model years before a recurring warning (fast retreat, cliff failure) may repeat. */
const EVENT_COOLDOWN_YEARS = 10;
const FAST_RETREAT_COOLDOWN_YEARS = 25;

/** E-folding time (model years) of the smoothed grounding-line retreat rate. */
const GL_RATE_SMOOTHING_YEARS = 5;

/**
 * Smoothed grounding-line retreat rates (m/yr) behind the events. In the
 * idealized MISI scenario, forced retreat across the sill runs at
 * 50–180 m/yr and stops when the forcing is removed; past the tipping point
 * on the retrograde bed the retreat keeps going and speeds up to
 * 200–500 m/yr. MISI ends once the retreat has stalled for
 * MISI_STALL_YEARS, so a temporary slowdown does not end it.
 */
const MISI_RETREAT_RATE = 200;
const MISI_STALL_RATE = 20;
const MISI_STALL_YEARS = 50;
const FAST_RETREAT_RATE = 100;
const HYSTERESIS_RETREAT_RATE = 50;

/** Model years the warming must have been reversed before retreat counts as irreversible. */
const HYSTERESIS_WAIT_YEARS = 20;

/** Whether any floating ice at least `minThickness` thick remains. */
function hasIceShelf(state: ModelState, minThickness: number): boolean {
  const { is_floating, H } = state;
  for (let i = 0; i < H.length; i++) {
    if (is_floating[i] === 1 && H[i] >= minThickness) return true;
  }
  return false;
}

/** True if `type` is not inside its cooldown window; starts a new window when it is ready. */
function takeCooldown(
  state: ModelState,
  type: GameEvent['type'],
  years: number = EVENT_COOLDOWN_YEARS,
): boolean {
  const until = state.event_cooldown_until?.[type];
  if (until != null && state.year < until) return false;
  state.event_cooldown_until = {
    ...state.event_cooldown_until,
    [type]: state.year + years,
  };
  return true;
}

/**
 * Compute effective dt limited by CFL condition.
 * CFL = u_max * dt / dx < CFL_MAX
 */
function cflLimitedDt(dt: number, uMax: number, dx: number): number {
  if (uMax <= 0) return dt;
  const cflDt = CFL_MAX * dx / uMax;
  return Math.min(dt, cflDt);
}

/**
 * Create the computational grid.
 */
function createGrid(nx: number, nz: number, domainLength: number): ModelGrid {
  const dx = (domainLength * 1000) / (nx - 1); // Convert km to m
  const dsigma = 1.0 / (nz - 1);
  const x = new Float64Array(nx);
  const sigma = new Float64Array(nz);

  for (let i = 0; i < nx; i++) {
    x[i] = i * dx;
  }
  for (let j = 0; j < nz; j++) {
    sigma[j] = j * dsigma;
  }

  return { nx, nz, dx, dsigma, x, sigma };
}

function interpolateAtGroundingLine(
  values: Float64Array,
  glIndex: number,
  glPosition: number,
  dx: number,
): number {
  if (values.length === 0) return 0;

  const leftIndex = Math.max(0, Math.min(glIndex, values.length - 1));
  const rightIndex = Math.min(leftIndex + 1, values.length - 1);
  if (leftIndex === rightIndex) return values[leftIndex];

  const leftX = leftIndex * dx;
  const lambda = Math.max(0, Math.min(1, (glPosition - leftX) / dx));
  return values[leftIndex] * (1 - lambda) + values[rightIndex] * lambda;
}

function computeGroundingLineFlux(state: ModelState): number {
  const { H, gl_index, gl_position, grid, u_depth_avg } = state;
  const thickness = interpolateAtGroundingLine(H, gl_index, gl_position, grid.dx);
  const velocity = interpolateAtGroundingLine(u_depth_avg, gl_index, gl_position, grid.dx);

  if (!Number.isFinite(thickness) || !Number.isFinite(velocity) || thickness <= 0) {
    return 0;
  }

  return (thickness * velocity * FLOWLINE_WIDTH_METERS) / 1e9;
}

function computeMassChangeGt(currentVolume: number, initialVolume: number): number {
  return (currentVolume - initialVolume) * GIGATONNES_PER_KM3_ICE;
}

function scenarioSeaLevelPotential(config: ScenarioConfig): number | undefined {
  const potential = config.sea_level_potential ?? config.region_info?.sea_level_m;
  return potential != null && potential > 0 ? potential : undefined;
}

function computeSeaLevelChange(
  initialVolumeAboveFlotation: number,
  currentVolumeAboveFlotation: number,
  config: ScenarioConfig,
): number {
  const lostAboveFlotation = Math.max(0, initialVolumeAboveFlotation - currentVolumeAboveFlotation);
  const potential = scenarioSeaLevelPotential(config);

  if (potential != null && initialVolumeAboveFlotation > 0) {
    const fractionLost = Math.min(1, lostAboveFlotation / initialVolumeAboveFlotation);
    return potential * fractionLost;
  }

  return lostAboveFlotation * VOLUME_TO_SLE * 1e9;
}

/**
 * Default user parameters.
 */
export function defaultParams(): UserParams {
  return {
    T_atm_delta: 0,
    T_ocean_delta: 0,
    precip_scale: 1.0,
    drain_efficiency: 1.0,
    enable_hydrology: false,
  };
}

/**
 * Initialize model state from a scenario configuration.
 */
export function initializeModel(config: ScenarioConfig): ModelState {
  const domainLength = config.domain_length || DEFAULT_DOMAIN_LENGTH;
  const nx = config.nx || Math.floor(domainLength / DEFAULT_DX) + 1;
  const nz = config.nz || DEFAULT_NZ;
  const grid = createGrid(nx, nz, domainLength);

  // Bedrock profile
  const b = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    if (config.bedrock && config.bedrock.length > 0) {
      // Interpolate from provided bedrock data
      const t = i / (nx - 1);
      const srcIdx = t * (config.bedrock.length - 1);
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, config.bedrock.length - 1);
      const frac = srcIdx - lo;
      b[i] = config.bedrock[lo] * (1 - frac) + config.bedrock[hi] * frac;
    } else {
      // Default: gentle downward slope
      b[i] = -100 - 500 * (i / (nx - 1));
    }
  }

  // Initial ice thickness
  const H = new Float64Array(nx);
  if (config.initial_H && config.initial_H.length > 0) {
    for (let i = 0; i < nx; i++) {
      const t = i / (nx - 1);
      const srcIdx = t * (config.initial_H.length - 1);
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, config.initial_H.length - 1);
      const frac = srcIdx - lo;
      H[i] = config.initial_H[lo] * (1 - frac) + config.initial_H[hi] * frac;
    }
  } else {
    // Default parabolic profile
    for (let i = 0; i < nx; i++) {
      const xNorm = i / (nx - 1);
      H[i] = Math.max(0, 3000 * (1 - xNorm * xNorm));
    }
  }

  // Compute initial floating mask and surface
  const { gl_index, gl_position, is_floating } = updateGroundingLine(H, b, grid);
  const s = computeSurfaceElevation(H, b, is_floating);
  const ice_base = computeIceBase(H, b, is_floating);

  // Initialize velocity field (simple SIA-like guess)
  const u = new Float64Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const sigma = j / (nz - 1);
      // Rough SIA profile: u(σ) ∝ (1 - (1-σ)^4)
      const siaFactor = 1 - Math.pow(1 - sigma, 4);
      const xNorm = i / (nx - 1);
      u[i * nz + j] = 100 * xNorm * siaFactor; // m/yr, increasing towards margin
    }
  }

  const params = defaultParams();
  params.enable_hydrology = config.enable_hydrology;

  // SMB
  const smb = computeSMB(s, params, config.T_atm_base, config.P_snow_base);

  // Water and effective pressure
  const W = new Float64Array(nx); // Start dry
  const N_eff = computeEffectivePressure(H, W, is_floating);

  // Basal melt (initially zero for grounded ice)
  const basal_melt = new Float64Array(nx);

  // Compute initial volume
  const { volume, volumeAboveFlotation } = computeIceVolume(H, b, is_floating, grid.dx);

  const state: ModelState = {
    grid,
    year: 0,
    H, b, s, ice_base,
    u,
    u_depth_avg: depthAverageVelocity(u, nx, nz),
    smb,
    basal_melt,
    N_eff,
    W,
    gl_index,
    gl_position,
    is_floating,
    prev_gl_position: gl_position,
    gl_retreat_rate: 0,
    is_misi_active: false,
    misi_triggered_year: -1,
    hysteresis_locked: false,
    cliff_height: 0,
    mici_calving_rate: 0,
    is_mici_active: false,
    initial_volume: volume,
    initial_volume_above_flotation: volumeAboveFlotation,
    volume,
    sea_level: 0,
    params,
  };

  // Basal friction inversion from observed velocity data
  if (config.geometry?.points) {
    const geoPts = config.geometry.points;
    const observedSpeed = new Float64Array(nx);

    // Interpolate observed speed from geometry points to model grid
    if (geoPts.length === nx) {
      for (let i = 0; i < nx; i++) {
        observedSpeed[i] = geoPts[i].speed_m_per_yr;
      }
    } else if (geoPts.length > 1) {
      for (let i = 0; i < nx; i++) {
        const t = i / (nx - 1);
        const srcIdx = t * (geoPts.length - 1);
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, geoPts.length - 1);
        const frac = srcIdx - lo;
        observedSpeed[i] = geoPts[lo].speed_m_per_yr * (1 - frac)
                         + geoPts[hi].speed_m_per_yr * frac;
      }
    }

    if (observedSpeed.some(v => v > 0)) {
      const drag = invertDragFields(state, observedSpeed, config.T_atm_base);
      state.C_basal = drag.C_basal;
      state.lateral_drag = drag.lateral_drag;
    }
  }

  // Without observations to invert, give floating ice the default side-wall
  // drag: an unconfined 2D shelf transmits no buttressing to the grounding
  // line, which would make shelf loss dynamically irrelevant.
  if (!state.lateral_drag) {
    state.lateral_drag = new Float64Array(nx).fill(config.lateral_drag ?? LATERAL_DRAG_DEFAULT);
  }

  // Replace the SIA-shaped initial guess with a real BP solution so the
  // first payload shows actual velocities and step 1 can reuse it.
  state.u = solveBP(state, config.T_atm_base);
  state.u_depth_avg = depthAverageVelocity(state.u, nx, nz);
  state.velocity_stale = false;
  state.had_shelf = hasIceShelf(state, SHELF_MIN_THICKNESS);

  return state;
}

/**
 * Forcing for one step on the current geometry: SMB, effective pressure,
 * velocity (reused from the previous end-of-step solve unless stale), the
 * CFL-limited step length, basal melt and hydrology.
 *
 * @returns The CFL-limited step (years) every process of this step uses.
 */
function updateForcing(state: ModelState, config: ScenarioConfig, dt: number): number {
  const { grid } = state;
  const { nx, nz } = grid;

  state.smb = computeSMB(state.s, state.params, config.T_atm_base, config.P_snow_base);
  if (!state.params.enable_hydrology) {
    state.W.fill(0);
  }
  state.N_eff = computeEffectivePressure(state.H, state.W, state.is_floating);

  // The worker marks the velocity stale whenever the user changes parameters.
  if (state.velocity_stale !== false) {
    state.u = solveBP(state, config.T_atm_base);
    state.u_depth_avg = depthAverageVelocity(state.u, nx, nz);
  }

  let uMax = 0;
  for (let i = 0; i < nx; i++) {
    if (state.u_depth_avg[i] > uMax) uMax = state.u_depth_avg[i];
  }
  const safeDt = cflLimitedDt(dt, uMax, grid.dx);

  const groundedBasalMelt = computeGroundedBasalMelt(
    basalVelocity(state.u, nx, nz), state.H, state.N_eff, state.is_floating, state.C_basal,
  );

  // Hydrology (its effect on sliding enters through N_eff at the end-of-step solve)
  if (state.params.enable_hydrology) {
    // Zwally feedback: route a fraction of surface melt (negative SMB) to the bed.
    const surfaceMelt = new Float64Array(nx);
    for (let i = 0; i < nx; i++) {
      surfaceMelt[i] = state.smb[i] < 0 ? -state.smb[i] : 0;
    }
    state.W = evolveHydrology(
      state.W, groundedBasalMelt.waterEq, state.is_floating, grid, state.params, safeDt,
      surfaceMelt,
    );
    state.N_eff = computeEffectivePressure(state.H, state.W, state.is_floating);
  }

  // Floating ice melts from the ocean; grounded ice from geothermal + frictional heat.
  state.basal_melt = computeOceanMelt(
    state.H, state.b, state.is_floating, state.params, config.T_ocean_base, grid.x,
  );
  for (let i = 0; i < nx; i++) {
    state.basal_melt[i] += groundedBasalMelt.iceEq[i];
  }
  return safeDt;
}

/** MICI cliff calving (opt-in); clears the diagnostics when disabled. */
function updateCliffCalving(state: ModelState, safeDt: number): void {
  if (!state.params.enable_mici) {
    state.cliff_height = 0;
    state.mici_calving_rate = 0;
    state.is_mici_active = false;
    state.mici_pending_retreat = 0;
    return;
  }
  const mici = applyCliffCalving(state, safeDt);
  state.H = mici.H;
  state.cliff_height = mici.cliff_height;
  state.mici_calving_rate = mici.mici_calving_rate;
  state.is_mici_active = mici.is_mici_active;
  state.mici_pending_retreat = mici.pending_retreat;
}

/**
 * Advance the geometry by `safeDt`: thickness, calving, grounding line,
 * surface, end-of-step velocity, volume, sea level and model time.
 */
function advanceGeometry(state: ModelState, config: ScenarioConfig, safeDt: number): void {
  const { grid } = state;
  const { nx, nz } = grid;

  const H_new = evolveThickness(
    state.H, state.u_depth_avg, state.smb, state.basal_melt, grid, safeDt,
  );
  state.H = applyCalving(H_new, state.is_floating).H;
  updateCliffCalving(state, safeDt);

  state.prev_gl_position = state.gl_position;
  const gl = updateGroundingLine(state.H, state.b, grid);
  state.gl_index = gl.gl_index;
  state.gl_position = gl.gl_position;
  state.is_floating = gl.is_floating;
  state.s = computeSurfaceElevation(state.H, state.b, state.is_floating);
  state.ice_base = computeIceBase(state.H, state.b, state.is_floating);

  // Re-solve the velocity on the updated geometry so the returned fields
  // (u, u_depth_avg, gl_flux, gl_velocity) match the new thickness and
  // grounding line. N_eff and SMB are refreshed first so newly (un)grounded
  // cells get the right basal condition; the next step reuses this solution.
  state.N_eff = computeEffectivePressure(state.H, state.W, state.is_floating);
  state.smb = computeSMB(state.s, state.params, config.T_atm_base, config.P_snow_base);
  state.u = solveBP(state, config.T_atm_base);
  state.u_depth_avg = depthAverageVelocity(state.u, nx, nz);
  state.velocity_stale = false;

  const { volume, volumeAboveFlotation } = computeIceVolume(
    state.H, state.b, state.is_floating, grid.dx,
  );
  state.volume = volume;
  // Sea level: only grounded ice above flotation contributes.
  state.sea_level = computeSeaLevelChange(
    state.initial_volume_above_flotation, volumeAboveFlotation, config,
  );
  state.year += safeDt;

  // GL retreat rate (m/yr, positive = retreat), smoothed over a few model
  // years: one 0.1-yr step of sub-grid GL jitter (tens of metres) would
  // otherwise read as hundreds of m/yr and trip the MISI / hysteresis detectors.
  if (safeDt > 0) {
    const instantRate = (state.prev_gl_position - state.gl_position) / safeDt;
    const weight = Math.min(1, safeDt / GL_RATE_SMOOTHING_YEARS);
    state.gl_retreat_rate += weight * (instantRate - state.gl_retreat_rate);
  }
}

/**
 * MISI: fast (smoothed) retreat while the grounding line sits on a
 * retrograde bed. It ends when the retreat stalls, so a grounding line that
 * restabilises (e.g. after prompt cooling) is no longer reported unstable.
 */
function detectMisi(state: ModelState): GameEvent | null {
  if (state.is_misi_active) {
    if (state.gl_retreat_rate >= MISI_STALL_RATE) {
      state.misi_stalled_since = undefined;
      return null;
    }
    state.misi_stalled_since ??= state.year;
    if (state.year - state.misi_stalled_since < MISI_STALL_YEARS) return null;
    state.is_misi_active = false;
    state.misi_stalled_since = undefined;
    return {
      type: 'ice_recovered',
      message_en: 'The grounding line has stopped retreating: the instability has stalled.',
      message_zh: '接地线已停止退缩：不稳定性已停滞。',
      severity: 'info',
    };
  }
  if (state.gl_retreat_rate <= MISI_RETREAT_RATE) return null;
  const { b, grid, gl_index: glIdx } = state;
  if (glIdx <= 0 || glIdx >= grid.nx - 1) return null;
  const dbdx = (b[glIdx + 1] - b[glIdx - 1]) / (2 * grid.dx);
  if (dbdx <= 0) return null;

  state.is_misi_active = true;
  state.misi_triggered_year = state.year;
  return {
    type: 'misi_triggered',
    message_en: 'Marine Ice Sheet Instability triggered! The grounding line is retreating on a retrograde slope — a positive feedback that accelerates collapse.',
    message_zh: '海洋冰盖不稳定性已触发！接地线正在逆坡上退缩——正反馈加速了崩塌。',
    severity: 'critical',
  };
}

/** Recurring warning, rate-limited by the event cooldown. */
function detectFastRetreat(state: ModelState): GameEvent | null {
  if (state.gl_retreat_rate <= FAST_RETREAT_RATE || state.is_misi_active) return null;
  if (!takeCooldown(state, 'gl_retreat_accelerating', FAST_RETREAT_COOLDOWN_YEARS)) return null;
  return {
    type: 'gl_retreat_accelerating',
    message_en: 'The grounding line is retreating rapidly!',
    message_zh: '接地线正在快速退缩！',
    severity: 'warning',
  };
}

/**
 * Fires on the step the last buttressing shelf disappears; a shelf that
 * regrows and breaks up again is announced at most once per cooldown.
 */
function detectShelfCollapse(state: ModelState): GameEvent | null {
  const shelfExists = hasIceShelf(state, SHELF_MIN_THICKNESS);
  const justCollapsed = state.had_shelf === true && !shelfExists;
  state.had_shelf = shelfExists;
  if (!justCollapsed || !takeCooldown(state, 'shelf_collapsed')) return null;
  return {
    type: 'shelf_collapsed',
    message_en: 'The ice shelf has collapsed! The "cork" is gone — ice will flow faster into the ocean.',
    message_zh: '冰架已崩塌！"瓶塞"消失了——冰将更快涌入海洋。',
    severity: 'critical',
  };
}

function detectMiciEvents(state: ModelState, prevMICIActive: boolean): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.is_mici_active && !prevMICIActive && takeCooldown(state, 'mici_triggered')) {
    events.push({
      type: 'mici_triggered',
      message_en: 'Marine Ice Cliff Instability activated! The exposed ice cliff is too tall to support itself — structural failure is accelerating calving.',
      message_zh: '海洋冰崖不稳定性已激活！暴露的冰崖太高无法自撑——结构破坏正在加速崩解。',
      severity: 'critical',
    });
  }
  if (
    state.mici_calving_rate > 500 && state.is_mici_active
    && takeCooldown(state, 'cliff_failure')
  ) {
    events.push({
      type: 'cliff_failure',
      message_en: `Rapid cliff failure: calving at ${state.mici_calving_rate.toFixed(0)} m/yr!`,
      message_zh: `冰崖快速崩塌：崩解速率 ${state.mici_calving_rate.toFixed(0)} 米/年！`,
      severity: 'critical',
    });
  }
  return events;
}

/**
 * Hysteresis: after warming, temperatures have been back at or below normal
 * for HYSTERESIS_WAIT_YEARS, yet the grounding line is still in unstable
 * retreat. Without prior warming there is nothing to "restore", and right
 * after a reversal the retreat is still coasting, so neither counts.
 */
function detectHysteresis(state: ModelState): GameEvent | null {
  const { T_atm_delta, T_ocean_delta } = state.params;
  state.peak_warming = Math.max(state.peak_warming ?? 0, T_atm_delta, T_ocean_delta);
  const restored = state.peak_warming > 0 && T_atm_delta <= 0 && T_ocean_delta <= 0;
  if (!restored) {
    state.climate_restored_year = undefined;
    return null;
  }
  state.climate_restored_year ??= state.year;
  if (!state.is_misi_active || state.hysteresis_locked) return null;
  if (state.year - state.climate_restored_year < HYSTERESIS_WAIT_YEARS) return null;
  if (state.gl_retreat_rate <= HYSTERESIS_RETREAT_RATE) return null;

  state.hysteresis_locked = true;
  return {
    type: 'hysteresis_locked',
    message_en: 'Even with temperatures restored, the ice sheet cannot recover. This is irreversible.',
    message_zh: '即使恢复温度，冰盖也无法恢复。这是不可逆的。',
    severity: 'critical',
  };
}

/** Announce each new whole metre of sea-level rise from 1 m upward. */
function detectSeaLevelMilestone(state: ModelState): GameEvent | null {
  const wholeMetres = Math.floor(state.sea_level);
  if (wholeMetres < 1 || wholeMetres <= (state.sea_level_alerted_m ?? 0)) return null;
  state.sea_level_alerted_m = wholeMetres;
  return {
    type: 'city_flooded',
    message_en: `Sea level has risen ${state.sea_level.toFixed(1)}m. Shanghai, Miami, and Tokyo face severe flooding.`,
    message_zh: `海平面上升了${state.sea_level.toFixed(1)}米。上海、迈阿密和东京面临严重洪水。`,
    severity: 'critical',
  };
}

/**
 * Game events for the step just taken. Each fires on a threshold crossing
 * (or at most once per cooldown window), never on every step.
 */
export function detectEvents(state: ModelState, prevMICIActive: boolean): GameEvent[] {
  const candidates = [
    detectMisi(state),
    detectFastRetreat(state),
    detectShelfCollapse(state),
    ...detectMiciEvents(state, prevMICIActive),
    detectHysteresis(state),
    detectSeaLevelMilestone(state),
  ];
  return candidates.filter((e): e is GameEvent => e !== null);
}

/**
 * Perform one physics time step.
 */
export function stepPhysics(
  state: ModelState,
  config: ScenarioConfig,
  dt: number = DEFAULT_DT,
): { state: ModelState; events: GameEvent[] } {
  const prevMICIActive = state.is_mici_active;
  const safeDt = updateForcing(state, config, dt);
  advanceGeometry(state, config, safeDt);
  return { state, events: detectEvents(state, prevMICIActive) };
}

/**
 * Extract the physics state payload for sending to the main thread.
 */
export function extractStatePayload(state: ModelState): PhysicsStatePayload {
  const { nx, nz } = state.grid;

  return {
    year: state.year,
    H: new Float64Array(state.H),
    u_surface: surfaceVelocity(state.u, nx, nz),
    u_base: basalVelocity(state.u, nx, nz),
    s: new Float64Array(state.s),
    b: new Float64Array(state.b),
    ice_base: new Float64Array(state.ice_base),
    gl_position: state.gl_position / 1000, // Convert to km
    gl_velocity: state.gl_index < nx
      ? state.u_depth_avg[state.gl_index]
      : 0,
    gl_flux_km3_yr: computeGroundingLineFlux(state),
    volume: state.volume,
    mass_change_gt: computeMassChangeGt(state.volume, state.initial_volume),
    sea_level: state.sea_level,
    // Ice-free cells are flagged floating (open ocean), so test thickness too.
    shelf_exists: hasIceShelf(state, H_MIN),
    water_pressure: new Float64Array(state.W),
    is_misi_active: state.is_misi_active,
    cliff_height: state.cliff_height,
    mici_calving_rate: state.mici_calving_rate,
    is_mici_active: state.is_mici_active,
    events: [],
    smb: new Float64Array(state.smb),
    u_depth_avg: new Float64Array(state.u_depth_avg),
    nx: state.grid.nx,
    nz: state.grid.nz,
    dsigma: state.grid.dsigma,
  };
}
