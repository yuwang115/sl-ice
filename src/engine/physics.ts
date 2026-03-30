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
  VOLUME_TO_SLE,
} from './constants';
import { solveBP, depthAverageVelocity, surfaceVelocity, basalVelocity } from './bp-solver';
import { computeSMB } from './smb';
import { computeOceanMelt } from './ocean-melt';
import { evolveThickness, applyCalving } from './ice-thickness';
import {
  updateGroundingLine, computeSurfaceElevation, computeIceBase, computeIceVolume,
  applySchoofFlux,
} from './grounding-line';
import { evolveHydrology, computeEffectivePressure } from './hydrology';
import type {
  ModelState, ModelGrid, ScenarioConfig, UserParams,
  PhysicsStatePayload, GameEvent,
} from './types';

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
  const { volume } = computeIceVolume(H, b, is_floating, grid.dx);

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
    initial_volume: volume,
    volume,
    sea_level: 0,
    params,
  };

  return state;
}

/**
 * Perform one physics time step.
 */
export function stepPhysics(
  state: ModelState,
  config: ScenarioConfig,
  dt: number = DEFAULT_DT,
): { state: ModelState; events: GameEvent[] } {
  const { grid } = state;
  const { nx, nz } = grid;
  const events: GameEvent[] = [];

  // 1. Update user-dependent fields
  // SMB
  state.smb = computeSMB(state.s, state.params, config.T_atm_base, config.P_snow_base);

  // Ocean melt (floating ice only)
  state.basal_melt = computeOceanMelt(
    state.H, state.b, state.is_floating, state.params,
    config.T_ocean_base, grid.x,
  );

  // Hydrology
  if (state.params.enable_hydrology) {
    const u_base = basalVelocity(state.u, nx, nz);
    state.W = evolveHydrology(
      state.W, state.H, state.b, state.s, u_base,
      state.N_eff, state.is_floating, grid, state.params, dt,
    );
    state.N_eff = computeEffectivePressure(state.H, state.W, state.is_floating);
  } else {
    // Default effective pressure (no hydrology)
    state.N_eff = computeEffectivePressure(
      state.H, new Float64Array(nx), state.is_floating,
    );
  }

  // 2. Solve BP velocity
  state.u = solveBP(state, config.T_atm_base);

  // Compute depth-averaged velocity
  state.u_depth_avg = depthAverageVelocity(state.u, nx, nz);

  // 2b. Apply grounding line flux parameterization
  // Ensures proper velocity at the GL for realistic GL migration
  applySchoofFlux(
    state.u_depth_avg, state.H, state.b, state.s, state.is_floating,
    state.gl_index, grid,
  );

  // 3. Evolve ice thickness
  const H_new = evolveThickness(
    state.H, state.u_depth_avg, state.smb, state.basal_melt, grid, dt,
  );

  // 4. Apply calving
  const { H: H_calved, calved } = applyCalving(H_new, state.is_floating);
  state.H = H_calved;

  // 5. Update grounding line
  state.prev_gl_position = state.gl_position;
  const gl = updateGroundingLine(state.H, state.b, grid);
  state.gl_index = gl.gl_index;
  state.gl_position = gl.gl_position;
  state.is_floating = gl.is_floating;

  // 6. Update surface elevation and ice base
  state.s = computeSurfaceElevation(state.H, state.b, state.is_floating);
  state.ice_base = computeIceBase(state.H, state.b, state.is_floating);

  // 7. Update volume and sea level
  const { volume } = computeIceVolume(
    state.H, state.b, state.is_floating, grid.dx,
  );
  state.volume = volume;

  // Sea level: change in volume above flotation
  state.sea_level = Math.max(0, (state.initial_volume - volume) * VOLUME_TO_SLE * 1e9);

  // 8. Advance time
  state.year += dt;

  // 9. Detect events
  // GL retreat rate
  state.gl_retreat_rate = (state.prev_gl_position - state.gl_position) / dt; // m/yr (positive = retreat)

  // MISI detection: accelerating retreat on retrograde slope
  if (state.gl_retreat_rate > 500 && !state.is_misi_active) {
    // Check if GL is on retrograde slope
    const glIdx = state.gl_index;
    if (glIdx > 0 && glIdx < nx - 1) {
      const dbdx = (state.b[glIdx + 1] - state.b[glIdx - 1]) / (2 * grid.dx);
      if (dbdx > 0) {
        // Retrograde slope + fast retreat = MISI
        state.is_misi_active = true;
        state.misi_triggered_year = state.year;
        events.push({
          type: 'misi_triggered',
          message_en: 'Marine Ice Sheet Instability triggered! The grounding line is retreating on a retrograde slope — a positive feedback that accelerates collapse.',
          message_zh: '海洋冰盖不稳定性已触发！接地线正在逆坡上退缩——正反馈加速了崩塌。',
          severity: 'critical',
        });
      }
    }
  }

  // GL accelerating retreat
  if (state.gl_retreat_rate > 200 && !state.is_misi_active) {
    events.push({
      type: 'gl_retreat_accelerating',
      message_en: 'The grounding line is retreating rapidly!',
      message_zh: '接地线正在快速退缩！',
      severity: 'warning',
    });
  }

  // Shelf collapse detection
  const shelfExists = state.is_floating.some((v: number) => v === 1 && state.H[state.is_floating.indexOf(v)] > 50);
  if (calved && !shelfExists) {
    events.push({
      type: 'shelf_collapsed',
      message_en: 'The ice shelf has collapsed! The "cork" is gone — ice will flow faster into the ocean.',
      message_zh: '冰架已崩塌！"瓶塞"消失了——冰将更快涌入海洋。',
      severity: 'critical',
    });
  }

  // Hysteresis detection: if MISI was triggered and user tries to reverse
  if (state.is_misi_active && state.params.T_atm_delta <= 0 && state.params.T_ocean_delta <= 0) {
    if (state.gl_retreat_rate > 100 && !state.hysteresis_locked) {
      state.hysteresis_locked = true;
      events.push({
        type: 'hysteresis_locked',
        message_en: 'Even with temperatures restored, the ice sheet cannot recover. This is irreversible.',
        message_zh: '即使恢复温度，冰盖也无法恢复。这是不可逆的。',
        severity: 'critical',
      });
    }
  }

  // Sea level city flooding
  if (state.sea_level > 1.0) {
    events.push({
      type: 'city_flooded',
      message_en: `Sea level has risen ${state.sea_level.toFixed(1)}m. Shanghai, Miami, and Tokyo face severe flooding.`,
      message_zh: `海平面上升了${state.sea_level.toFixed(1)}米。上海、迈阿密和东京面临严重洪水。`,
      severity: 'critical',
    });
  }

  return { state, events };
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
    volume: state.volume,
    sea_level: state.sea_level,
    shelf_exists: state.is_floating.some((v: number) => v === 1),
    water_pressure: new Float64Array(state.W),
    is_misi_active: state.is_misi_active,
    events: [],
    smb: new Float64Array(state.smb),
    u_depth_avg: new Float64Array(state.u_depth_avg),
  };
}
