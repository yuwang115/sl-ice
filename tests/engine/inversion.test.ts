import { describe, it, expect } from 'vitest';
import { invertBasalFriction } from '../../src/engine/inversion';
import { C_BASAL_MIN, C_BASAL_MAX, RHO_ICE, RHO_WATER } from '../../src/engine/constants';
import type { ModelState, ModelGrid } from '../../src/engine/types';

/** Helper: create a minimal model state for inversion tests. */
function createTestState(overrides: {
  nx?: number;
  nz?: number;
  H?: Float64Array;
  b?: Float64Array;
  is_floating?: Uint8Array;
}): ModelState {
  const nx = overrides.nx ?? 20;
  const nz = overrides.nz ?? 5;
  const dx = 2000; // 2 km

  const grid: ModelGrid = {
    nx, nz,
    dx,
    dsigma: 1 / (nz - 1),
    x: new Float64Array(nx).map((_, i) => i * dx),
    sigma: new Float64Array(nz).map((_, j) => j / (nz - 1)),
  };

  const H = overrides.H ?? new Float64Array(nx).fill(2000);
  const b = overrides.b ?? new Float64Array(nx).fill(-500);
  const is_floating = overrides.is_floating ?? new Uint8Array(nx).fill(0);

  // Compute surface elevation
  const s = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    if (is_floating[i]) {
      s[i] = H[i] * (1 - RHO_ICE / RHO_WATER);
    } else {
      s[i] = b[i] + H[i];
    }
  }

  const ice_base = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    ice_base[i] = is_floating[i] ? -(H[i] * RHO_ICE / RHO_WATER) : b[i];
  }

  // Simple velocity initialisation
  const u = new Float64Array(nx * nz);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      u[i * nz + j] = 50 * (i / (nx - 1));
    }
  }

  const N_eff = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    N_eff[i] = is_floating[i] ? 0 : RHO_ICE * 9.81 * H[i] * 0.1;
  }

  return {
    grid,
    year: 0,
    H, b, s, ice_base,
    u,
    u_depth_avg: new Float64Array(nx),
    smb: new Float64Array(nx).fill(0.3),
    basal_melt: new Float64Array(nx),
    N_eff,
    W: new Float64Array(nx),
    gl_index: nx - 1,
    gl_position: (nx - 1) * dx,
    is_floating,
    prev_gl_position: (nx - 1) * dx,
    gl_retreat_rate: 0,
    is_misi_active: false,
    misi_triggered_year: -1,
    hysteresis_locked: false,
    cliff_height: 0,
    mici_calving_rate: 0,
    is_mici_active: false,
    initial_volume: 0,
    initial_volume_above_flotation: 0,
    volume: 0,
    sea_level: 0,
    params: {
      T_atm_delta: 0,
      T_ocean_delta: 0,
      precip_scale: 1,
      drain_efficiency: 1,
      enable_hydrology: false,
    },
  };
}

describe('invertBasalFriction', () => {
  it('returns C(x) array of correct length', () => {
    const nx = 20;
    const state = createTestState({ nx });
    const u_obs = new Float64Array(nx).fill(100);

    const C = invertBasalFriction(state, u_obs, -20);

    expect(C).toBeInstanceOf(Float64Array);
    expect(C.length).toBe(nx);
  });

  it('sets C = 0 for floating nodes', () => {
    const nx = 10;
    const is_floating = new Uint8Array(nx);
    is_floating[8] = 1;
    is_floating[9] = 1;
    const state = createTestState({ nx, is_floating });
    const u_obs = new Float64Array(nx).fill(100);

    const C = invertBasalFriction(state, u_obs, -20);

    expect(C[8]).toBe(0);
    expect(C[9]).toBe(0);
  });

  it('keeps C within physical bounds [C_MIN, C_MAX]', () => {
    const nx = 20;
    const state = createTestState({ nx });
    const u_obs = new Float64Array(nx).fill(100);

    const C = invertBasalFriction(state, u_obs, -20);

    for (let i = 0; i < nx; i++) {
      if (!state.is_floating[i]) {
        expect(C[i]).toBeGreaterThanOrEqual(C_BASAL_MIN);
        expect(C[i]).toBeLessThanOrEqual(C_BASAL_MAX);
      }
    }
  });

  it('assigns C_MAX for near-zero observed velocity (frozen bed)', () => {
    const nx = 10;
    const state = createTestState({ nx });
    const u_obs = new Float64Array(nx).fill(100);
    u_obs[2] = 0.1; // Near-zero → frozen bed

    const C = invertBasalFriction(state, u_obs, -20);

    expect(C[2]).toBe(C_BASAL_MAX);
  });

  it('does not modify state.C_basal after inversion', () => {
    const nx = 10;
    const state = createTestState({ nx });
    const u_obs = new Float64Array(nx).fill(100);

    expect(state.C_basal).toBeUndefined();
    invertBasalFriction(state, u_obs, -20);
    expect(state.C_basal).toBeUndefined();
  });

  it('produces smooth output (no sharp jumps between adjacent grounded nodes)', () => {
    const nx = 30;
    const state = createTestState({ nx });
    // Varying observed velocity to create spatial variation in C
    const u_obs = new Float64Array(nx);
    for (let i = 0; i < nx; i++) {
      u_obs[i] = 50 + 200 * (i / (nx - 1));
    }

    const C = invertBasalFriction(state, u_obs, -20);

    // Check that adjacent grounded nodes don't differ by more than 10x
    for (let i = 1; i < nx; i++) {
      if (!state.is_floating[i] && !state.is_floating[i - 1] && C[i] > 0 && C[i - 1] > 0) {
        const ratio = C[i] / C[i - 1];
        expect(ratio).toBeLessThan(10);
        expect(ratio).toBeGreaterThan(0.1);
      }
    }
  });
});
