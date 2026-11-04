import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeModel, stepPhysics, detectEvents } from '../../src/engine/physics';
import { solveBP, depthAverageVelocity, marginStress } from '../../src/engine/bp-solver';
import { basalDragCoefficient } from '../../src/engine/friction';
import { applyCalving, evolveThickness } from '../../src/engine/ice-thickness';
import {
  iceTemperature, flowRateFactor, surfaceTemperature,
} from '../../src/engine/temperature';
import { C_SLIDING, G, RHO_ICE, RHO_WATER, SEC_PER_YEAR } from '../../src/engine/constants';
import type { ModelGrid, ScenarioConfig } from '../../src/engine/types';

/** Uniform floating shelf; drag-free unless `withDrag` (initializeModel adds the default). */
function unconfinedShelf(nx: number, H: number) {
  const state = initializeModel(shelfScenario(nx, H));
  state.lateral_drag = undefined;
  return state;
}

function shelfScenario(nx: number, H: number): ScenarioConfig {
  return {
    name: 'uniform-shelf',
    domain_length: 2 * (nx - 1),
    nx,
    nz: 10,
    T_atm_base: -20,
    T_ocean_base: -1.9,
    P_snow_base: 0.3,
    enable_hydrology: false,
    bedrock: new Array(nx).fill(-3000),
    initial_H: new Array(nx).fill(H),
  } as ScenarioConfig;
}

describe('Blatter–Pattyn solver', () => {
  it('spreads an unconfined uniform ice shelf at the analytic rate', () => {
    const nx = 41;
    const H = 400;
    const state = unconfinedShelf(nx, H);
    const nz = state.grid.nz;
    const uAvg = depthAverageVelocity(solveBP(state, -20), nx, nz);

    // Velocity grows away from the pinned divide toward the calving front
    for (let i = 1; i < nx; i++) expect(uAvg[i]).toBeGreaterThan(uAvg[i - 1]);

    // ε̇ = (ρᵢ g H (1 − ρᵢ/ρ_w) / 4)³ / ⟨A^(-1/3)⟩³ for depth-varying A(T)
    const Ts = surfaceTemperature(state.s[5], 0, -20);
    let invA = 0;
    for (let j = 0; j < nz; j++) {
      const w = j === 0 || j === nz - 1 ? 0.5 : 1;
      const T = iceTemperature(j / (nz - 1), Ts, H, Math.max(0, state.smb[5]));
      invA += w * Math.pow(flowRateFactor(T), -1 / 3);
    }
    invA /= nz - 1;
    const stress = 0.25 * RHO_ICE * G * H * (1 - RHO_ICE / RHO_WATER);
    const analytic = Math.pow(stress / invA, 3);
    const modelled = (uAvg[30] - uAvg[10]) / (20 * state.grid.dx);
    expect(modelled / analytic).toBeGreaterThan(0.9);
    expect(modelled / analytic).toBeLessThan(1.1);
  });

  it('keeps a retreated calving front flowing instead of pinning it to open water', () => {
    const nx = 41;
    const full = unconfinedShelf(nx, 400);
    const nz = full.grid.nz;
    const uFull = depthAverageVelocity(solveBP(full, -20), nx, nz);

    // Same shelf with the last 10 cells calved away
    const cfg = shelfScenario(nx, 400);
    cfg.initial_H = cfg.initial_H!.map((h, i) => (i > 30 ? 0 : h));
    const retreated = initializeModel(cfg);
    retreated.lateral_drag = undefined;
    const uRetreated = depthAverageVelocity(solveBP(retreated, -20), nx, nz);

    // The new front (i = 30) behaves like a front, not like a wall
    expect(uRetreated[30]).toBeGreaterThan(0.9 * uFull[30]);
    expect(uRetreated[31]).toBe(0); // open water carries no velocity
  });

  it('slows a shelf with lateral (side-wall) drag', () => {
    const nx = 41;
    const free = unconfinedShelf(nx, 400);
    const nz = free.grid.nz;
    const uFree = depthAverageVelocity(solveBP(free, -20), nx, nz);
    const confined = initializeModel(shelfScenario(nx, 400)); // default drag
    expect(confined.lateral_drag?.[20]).toBeGreaterThan(0);
    const uConfined = depthAverageVelocity(solveBP(confined, -20), nx, nz);
    expect(uConfined[nx - 1]).toBeLessThan(0.8 * uFree[nx - 1]);
    expect(uConfined[nx - 1]).toBeGreaterThan(0);
  });

  it('includes sea-water back-pressure at a grounded marine cliff', () => {
    expect(marginStress(1000, 200)).toBeCloseTo(0.5 * RHO_ICE * G * 1000, 6); // on land
    const marine = marginStress(1000, -300);
    const expected = (0.5 * RHO_ICE * G * 1e6 - 0.5 * RHO_WATER * G * 300 * 300) / 1000;
    expect(marine).toBeCloseTo(expected, 6);
  });
});

describe('basal friction law', () => {
  it('recovers the plain Weertman law on a dry bed', () => {
    const H = 1000;
    const overburden = RHO_ICE * G * H;
    const u = 100;
    const tau = basalDragCoefficient(C_SLIDING, u, overburden, H) * u;
    expect(tau).toBeCloseTo(C_SLIDING * Math.cbrt(u), -1);
    // MISMIP coefficient in yearly units
    expect(C_SLIDING).toBeCloseTo(7.624e6 / Math.cbrt(SEC_PER_YEAR), 3);
  });

  it('scales drag with (N/N0)^(1/3) (Budd: u_b ∝ τ³/N) and vanishes without ice', () => {
    const H = 1000;
    const overburden = RHO_ICE * G * H;
    const dry = basalDragCoefficient(C_SLIDING, 50, overburden, H);
    const wet = basalDragCoefficient(C_SLIDING, 50, 0.25 * overburden, H);
    expect(wet / dry).toBeCloseTo(Math.cbrt(0.25), 6);
    expect(basalDragCoefficient(C_SLIDING, 50, 0, 0)).toBe(0);
  });
});

describe('calving and frontal mass flux', () => {
  const grid: ModelGrid = {
    nx: 6, nz: 2, dx: 2000, dsigma: 1,
    x: new Float64Array([0, 2000, 4000, 6000, 8000, 10000]),
    sigma: new Float64Array([0, 1]),
  };

  it('does not report calving when the ocean end is already open water', () => {
    const H = new Float64Array([800, 600, 300, 200, 0, 0]);
    const floating = new Uint8Array([0, 0, 1, 1, 1, 1]);
    expect(applyCalving(H, floating).calved).toBe(false);
  });

  it('removes floating ice cut off from the ice body by an ice-free gap', () => {
    const H = new Float64Array([800, 600, 300, 0, 200, 150]);
    const floating = new Uint8Array([0, 0, 1, 1, 1, 1]);
    const { H: out, calved } = applyCalving(H, floating);
    expect(calved).toBe(true);
    expect(Array.from(out)).toEqual([800, 600, 300, 0, 0, 0]);
  });

  it('drains the full frontal flux u·H out of a retreated front cell', () => {
    const H = new Float64Array([800, 600, 300, 0, 0, 0]);
    const u = new Float64Array([0, 100, 200, 0, 0, 0]);
    const zero = new Float64Array(6);
    const dt = 0.1;
    const out = evolveThickness(H, u, zero, zero, grid, dt);
    const expectedFront = 300 - dt * (200 * 300 - 0.5 * (100 + 200) * 600) / 2000;
    expect(out[2]).toBeCloseTo(expectedFront, 9);
  });
});

describe('stepPhysics bookkeeping', () => {
  it('reuses the end-of-step velocity only while forcing is unchanged', () => {
    const state = initializeModel(shelfScenario(21, 400));
    expect(state.velocity_stale).toBe(false);
    const cfg = shelfScenario(21, 400);
    stepPhysics(state, cfg, 0.1);
    expect(state.velocity_stale).toBe(false);

    // The cached field equals a fresh solve on the same state
    const fresh = solveBP(state, cfg.T_atm_base);
    let maxDiff = 0;
    for (let k = 0; k < fresh.length; k++) maxDiff = Math.max(maxDiff, Math.abs(fresh[k] - state.u[k]));
    expect(maxDiff).toBeLessThan(1);
  });

  it('announces sea-level milestones once per whole metre', () => {
    const cfg = shelfScenario(21, 400);
    const state = initializeModel(cfg);
    const seen: string[] = [];
    state.sea_level_alerted_m = 0;
    for (const sl of [0.5, 1.2, 1.4, 1.9, 2.1, 2.2]) {
      // Force the diagnostic through a large potential and a fake loss
      state.initial_volume_above_flotation = 1;
      cfg.sea_level_potential = sl;
      const { events } = stepPhysics(state, cfg, 0.1);
      seen.push(...events.filter((e) => e.type === 'city_flooded').map(() => String(sl)));
    }
    // All ice is floating, so above-flotation loss is 100 % of the 1 km³ we set
    expect(seen).toEqual(['1.2', '2.1']);
  });
});

describe('game events', () => {
  function misiState() {
    const state = initializeModel(shelfScenario(21, 400));
    state.is_misi_active = true;
    state.gl_retreat_rate = 300; // m/yr, sustained retreat
    return state;
  }

  it('does not claim irreversibility when the user never warmed the climate', () => {
    const state = misiState();
    const events = detectEvents(state, false);
    expect(events.map((e) => e.type)).not.toContain('hysteresis_locked');
    expect(state.hysteresis_locked).toBe(false);
  });

  it('locks hysteresis once, after warming has been reversed for 20 years and retreat continues', () => {
    const state = misiState();
    const types = () => detectEvents(state, false).map((e) => e.type);
    state.params = { ...state.params, T_ocean_delta: 2 };
    expect(types()).not.toContain('hysteresis_locked');
    state.params = { ...state.params, T_ocean_delta: 0 };
    expect(types()).not.toContain('hysteresis_locked'); // just reversed: retreat still coasting
    state.year += 10;
    expect(types()).not.toContain('hysteresis_locked');
    state.year += 15;
    expect(types()).toContain('hysteresis_locked');
    expect(types()).not.toContain('hysteresis_locked');
  });

  it('ends MISI, and never locks hysteresis, once the grounding line stops after cooling', () => {
    const state = misiState();
    state.params = { ...state.params, T_ocean_delta: 2 };
    detectEvents(state, false);
    state.params = { ...state.params, T_ocean_delta: 0 };
    detectEvents(state, false);
    state.year += 25;
    state.gl_retreat_rate = 5; // stalled
    expect(detectEvents(state, false).map((e) => e.type)).not.toContain('ice_recovered');
    state.year += 30; // a temporary slowdown does not end MISI
    expect(state.is_misi_active).toBe(true);
    state.year += 20;
    const events = detectEvents(state, false).map((e) => e.type);
    expect(events).toContain('ice_recovered');
    expect(events).not.toContain('hysteresis_locked');
    expect(state.is_misi_active).toBe(false);
    expect(detectEvents(state, false).map((e) => e.type)).not.toContain('ice_recovered');
  });

  /** Marine sheet whose bed rises (slope > 0, retrograde) or falls seaward. */
  function marineSheet(bedSlopePerNode: number) {
    const nx = 21;
    const cfg = shelfScenario(nx, 0);
    cfg.bedrock = Array.from({ length: nx }, (_, i) => -800 + bedSlopePerNode * (i - 10));
    cfg.initial_H = Array.from({ length: nx }, (_, i) => (i <= 10 ? 1500 - 40 * i : 300));
    return initializeModel(cfg);
  }

  it('triggers MISI for fast retreat on a retrograde bed only', () => {
    const retrograde = marineSheet(20);
    expect(retrograde.gl_index).toBeGreaterThan(0);
    retrograde.gl_retreat_rate = 150; // forced retreat across the sill, below the MISI rate
    expect(detectEvents(retrograde, false).map((e) => e.type)).not.toContain('misi_triggered');
    retrograde.gl_retreat_rate = 250;
    expect(detectEvents(retrograde, false).map((e) => e.type)).toContain('misi_triggered');

    const prograde = marineSheet(-20);
    prograde.gl_retreat_rate = 250;
    expect(detectEvents(prograde, false).map((e) => e.type)).not.toContain('misi_triggered');
    expect(prograde.is_misi_active).toBe(false);
  });

  it('reports a shelf collapse once, on the step the shelf disappears', () => {
    const state = initializeModel(shelfScenario(21, 400));
    expect(state.had_shelf).toBe(true);
    state.H.fill(20); // thinner than a buttressing shelf
    expect(detectEvents(state, false).map((e) => e.type)).toContain('shelf_collapsed');
    expect(detectEvents(state, false).map((e) => e.type)).not.toContain('shelf_collapsed');
  });
});

describe('idealized challenge scenarios', () => {
  // These ship a spun-up initial_H (steady state under default parameters).
  // If the physics changes, re-run the spin-up or this guard will trip.
  it.each(['scenario_a_stable', 'scenario_b_misi', 'scenario_c_shelf'])(
    '%s starts near steady state',
    (name) => {
      const path = resolve(process.cwd(), 'public/data/scenarios', `${name}.json`);
      const cfg = JSON.parse(readFileSync(path, 'utf8')) as ScenarioConfig;
      const state = initializeModel(cfg);
      const v0 = state.volume;
      const gl0 = state.gl_position;
      for (let i = 0; i < 100; i++) stepPhysics(state, cfg, 0.1); // 10 model years
      expect(Math.abs(state.volume / v0 - 1)).toBeLessThan(0.002);
      expect(Math.abs(state.gl_position - gl0)).toBeLessThan(4000);
    },
  );
});
