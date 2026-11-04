import { describe, expect, it } from 'vitest';

import {
  applyCliffCalving, cliffCalvingParameters, computeMICICalvingRate, findCalvingFront,
} from '../../src/engine/cliff-calving';
import { MICI_C_MAX, MICI_F_MARGIN, RHO_ICE, RHO_WATER } from '../../src/engine/constants';
import { initializeModel } from '../../src/engine/physics';
import type { ScenarioConfig } from '../../src/engine/types';

describe('Schlemm & Levermann (2019) cliff-calving law', () => {
  // Their Table 1: w, s, F_c (m), F_s (m)
  it.each([
    [0, 1.93, 75.0, 22.85],
    [0.5, 2.27, 50.5, 21.05],
    [0.8, 2.75, 35.8, 25.47],
    [0.9, 3.0, 30.9, 31.07],
  ])('matches Table 1 at w = %s', (w, s, Fc, Fs) => {
    const p = cliffCalvingParameters(w);
    expect(p.exponent).toBeCloseTo(s, 2);
    expect(p.criticalFreeboard).toBeCloseTo(Fc, 1);
    expect(p.scaleFreeboard).toBeCloseTo(Fs, 1);
  });

  it('is zero up to the raised critical freeboard, then grows steeply to the cap', () => {
    const w = 0.85;
    const threshold = cliffCalvingParameters(w).criticalFreeboard + MICI_F_MARGIN;
    expect(computeMICICalvingRate(threshold, w)).toBe(0);
    const near = computeMICICalvingRate(threshold + 20, w);
    const far = computeMICICalvingRate(threshold + 40, w);
    expect(near).toBeGreaterThan(0);
    expect(far / near).toBeGreaterThan(4); // exponent ~2.9
    expect(computeMICICalvingRate(threshold + 500, w)).toBe(MICI_C_MAX);
    expect(computeMICICalvingRate(threshold + 40, w, 0)).toBe(0);
  });
});

describe('calving front', () => {
  const bed = new Float64Array([-500, -900, -1200]);

  it('measures a grounded cliff against the local water depth', () => {
    const H = new Float64Array([1600, 1500, 0]);
    const front = findCalvingFront(H, bed, new Uint8Array([0, 0, 1]));
    expect(front?.index).toBe(1);
    expect(front?.freeboard).toBeCloseTo(600);
    expect(front?.relativeDepth).toBeCloseTo(0.6);
  });

  it('measures a floating front at its draft', () => {
    const H = new Float64Array([1600, 1500, 300]);
    const front = findCalvingFront(H, bed, new Uint8Array([0, 0, 1]));
    expect(front?.index).toBe(2);
    expect(front?.freeboard).toBeCloseTo(300 * (1 - RHO_ICE / RHO_WATER));
  });

  it('has no marine cliff when the ice ends on land', () => {
    const front = findCalvingFront(new Float64Array([800, 600]), new Float64Array([100, 50]), new Uint8Array(2));
    expect(front).toBeNull();
  });
});

describe('applyCliffCalving', () => {
  /** Grounded slab ending in a 1200 m deep ocean: a 400 m tall cliff. */
  function cliffState(sensitivity: number) {
    const nx = 21;
    const cfg = {
      name: 'cliff', domain_length: 40, nx, nz: 6,
      T_atm_base: -20, T_ocean_base: -1.5, P_snow_base: 0.3, enable_hydrology: false,
      bedrock: new Array(nx).fill(-1200),
      initial_H: Array.from({ length: nx }, (_, i) => (i <= 15 ? 1600 : 0)),
    } as ScenarioConfig;
    const state = initializeModel(cfg);
    state.params = { ...state.params, enable_mici: true, mici_sensitivity: sensitivity };
    return state;
  }

  it('retreats a tall grounded cliff by whole cells at the calving rate', () => {
    const state = cliffState(1);
    const first = applyCliffCalving(state, 0.1);
    expect(first.is_mici_active).toBe(true);
    expect(first.cliff_height).toBeCloseTo(400);
    expect(first.mici_calving_rate).toBe(MICI_C_MAX);

    let H = state.H;
    let pending = 0;
    for (let step = 0; step < 30; step++) { // 3 years at 1500 m/yr = 4500 m
      state.H = H;
      state.mici_pending_retreat = pending;
      const result = applyCliffCalving(state, 0.1);
      H = result.H;
      pending = result.pending_retreat;
    }
    // dx = 2 km: two whole cells gone, 500 m carried over, the cliff intact.
    expect(Array.from(H.slice(13, 17))).toEqual([1600, 0, 0, 0]);
    expect(pending).toBeCloseTo(500);
  });

  it('leaves an ice sheet with a thin shelf front alone', () => {
    const state = cliffState(1);
    state.H.fill(200, 16); // a 200 m shelf in front of the cliff
    state.is_floating.fill(1, 16);
    const result = applyCliffCalving(state, 0.1);
    expect(result.is_mici_active).toBe(false);
    expect(Array.from(result.H)).toEqual(Array.from(state.H));
  });
});
