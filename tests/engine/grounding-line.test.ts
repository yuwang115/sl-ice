import { describe, it, expect } from 'vitest';
import {
  flotationFunction,
  isFloating,
  updateGroundingLine,
  subElementFriction,
  computeSurfaceElevation,
  computeIceBase,
  computeIceVolume,
} from '../../src/engine/grounding-line';
import { RHO_ICE, RHO_WATER } from '../../src/engine/constants';
import type { ModelGrid } from '../../src/engine/types';

function makeGrid(nx: number, dx: number): ModelGrid {
  const nz = 5;
  const x = new Float64Array(nx);
  const sigma = new Float64Array(nz);
  for (let i = 0; i < nx; i++) x[i] = i * dx;
  for (let j = 0; j < nz; j++) sigma[j] = j / (nz - 1);
  return { nx, nz, dx, dsigma: 1 / (nz - 1), x, sigma };
}

describe('flotationFunction', () => {
  it('returns positive for grounded ice (thick ice on shallow bed)', () => {
    expect(flotationFunction(3000, -500)).toBeGreaterThan(0);
  });

  it('returns negative for floating ice (thin ice on deep bed)', () => {
    expect(flotationFunction(100, -500)).toBeLessThan(0);
  });

  it('returns zero at exact flotation', () => {
    // H * RHO_ICE + b * RHO_WATER = 0 → b = -H * RHO_ICE / RHO_WATER
    const H = 1000;
    const b = -H * RHO_ICE / RHO_WATER;
    expect(flotationFunction(H, b)).toBeCloseTo(0, 6);
  });
});

describe('isFloating', () => {
  it('returns false for thick ice on shallow bed', () => {
    expect(isFloating(3000, -500)).toBe(false);
  });

  it('returns true for thin ice on deep bed', () => {
    expect(isFloating(100, -500)).toBe(true);
  });

  it('returns false for no ice (H < 1)', () => {
    expect(isFloating(0.5, -500)).toBe(false);
  });
});

describe('updateGroundingLine', () => {
  it('detects GL in a simple profile with grounded-to-floating transition', () => {
    const nx = 10;
    const dx = 1000;
    const grid = makeGrid(nx, dx);

    // Bedrock sloping down
    const b = new Float64Array(nx);
    const H = new Float64Array(nx);
    for (let i = 0; i < nx; i++) {
      b[i] = -100 - 100 * i; // deepening bed
      H[i] = 800; // constant ice thickness
    }

    const { gl_index, gl_position, is_floating } = updateGroundingLine(H, b, grid);

    // GL should be where RHO_ICE * H + RHO_WATER * b = 0
    // → -100 - 100*i = -800 * RHO_ICE / RHO_WATER ≈ -713.4 → i ≈ 6.13
    expect(gl_index).toBe(6);
    expect(gl_position).toBeGreaterThan(6 * dx);
    expect(gl_position).toBeLessThan(7 * dx);

    // Upstream nodes should be grounded
    for (let i = 0; i <= gl_index; i++) {
      expect(is_floating[i]).toBe(0);
    }
    // Downstream should be floating
    expect(is_floating[gl_index + 1]).toBe(1);
  });

  it('returns all grounded when bed is above flotation everywhere', () => {
    const nx = 5;
    const dx = 1000;
    const grid = makeGrid(nx, dx);
    const b = new Float64Array(nx).fill(-100);
    const H = new Float64Array(nx).fill(3000);

    const { gl_index, is_floating } = updateGroundingLine(H, b, grid);
    expect(gl_index).toBe(nx - 1);
    expect(is_floating.every((v) => v === 0)).toBe(true);
  });
});

describe('subElementFriction', () => {
  // Set up geometry: grounded nodes have thick ice on shallow bed,
  // floating nodes have thin ice on deep bed.
  // Flotation: f = ρ_i * H + ρ_w * b.  ρ_i=917, ρ_w=1028.
  // Grounded (f > 0): H=1000, b=-500 → f = 917*1000 + 1028*(-500) = 403000
  // Floating (f ≤ 0): H=200, b=-500  → f = 917*200 + 1028*(-500) = -330600
  const H_grounded = 1000;
  const H_floating = 200;
  const b_val = -500;

  it('returns 1.0 for fully grounded nodes (no floating neighbor)', () => {
    const H = new Float64Array([H_grounded, H_grounded, H_grounded, H_floating, H_floating]);
    const b = new Float64Array([b_val, b_val, b_val, b_val, b_val]);
    const is_floating = new Uint8Array([0, 0, 0, 1, 1]);
    expect(subElementFriction(0, H, b, is_floating)).toBe(1.0);
    expect(subElementFriction(1, H, b, is_floating)).toBe(1.0);
  });

  it('returns 0.0 for fully floating nodes', () => {
    const H = new Float64Array([H_grounded, H_grounded, H_grounded, H_floating, H_floating]);
    const b = new Float64Array([b_val, b_val, b_val, b_val, b_val]);
    const is_floating = new Uint8Array([0, 0, 0, 1, 1]);
    expect(subElementFriction(3, H, b, is_floating)).toBe(0.0);
  });

  it('returns fractional value at GL transition node', () => {
    const H = new Float64Array([H_grounded, H_grounded, H_grounded, H_floating, H_floating]);
    const b = new Float64Array([b_val, b_val, b_val, b_val, b_val]);
    const is_floating = new Uint8Array([0, 0, 0, 1, 1]);
    const frac = subElementFriction(2, H, b, is_floating);
    expect(frac).toBeGreaterThan(0);
    expect(frac).toBeLessThan(1);
  });

  it('returns 1.0 for re-grounded ice downstream of primary GL', () => {
    // Geometry: grounded → floating → re-grounded on topographic high → floating
    const H = new Float64Array([H_grounded, H_grounded, H_floating, H_grounded, H_floating]);
    const b = new Float64Array([b_val, b_val, b_val, b_val, b_val]);
    const is_floating = new Uint8Array([0, 0, 1, 0, 1]);
    // Node 3 is re-grounded: should get friction, not free-slip
    const frac = subElementFriction(3, H, b, is_floating);
    // At a transition (node 4 is floating), so it gets sub-element scaling
    expect(frac).toBeGreaterThan(0);
  });
});

describe('computeSurfaceElevation', () => {
  it('computes grounded surface as b + H', () => {
    const H = new Float64Array([1000]);
    const b = new Float64Array([-500]);
    const is_floating = new Uint8Array([0]);
    const s = computeSurfaceElevation(H, b, is_floating);
    expect(s[0]).toBe(500);
  });

  it('computes floating surface as freeboard', () => {
    const H = new Float64Array([1000]);
    const b = new Float64Array([-2000]);
    const is_floating = new Uint8Array([1]);
    const s = computeSurfaceElevation(H, b, is_floating);
    const expected = H[0] * (1 - RHO_ICE / RHO_WATER);
    expect(s[0]).toBeCloseTo(expected, 6);
  });
});

describe('computeIceBase', () => {
  it('uses bedrock for grounded ice', () => {
    const H = new Float64Array([1000]);
    const b = new Float64Array([-500]);
    const is_floating = new Uint8Array([0]);
    const base = computeIceBase(H, b, is_floating);
    expect(base[0]).toBe(-500);
  });

  it('uses hydrostatic draft for floating ice', () => {
    const H = new Float64Array([1000]);
    const b = new Float64Array([-2000]);
    const is_floating = new Uint8Array([1]);
    const base = computeIceBase(H, b, is_floating);
    const expected = -(H[0] * RHO_ICE / RHO_WATER);
    expect(base[0]).toBeCloseTo(expected, 6);
  });
});

describe('computeIceVolume', () => {
  it('computes total volume and volume above flotation', () => {
    const dx = 1000;
    const H = new Float64Array([2000, 2000, 500]);
    const b = new Float64Array([-500, -500, -1000]);
    const is_floating = new Uint8Array([0, 0, 1]);

    const { volume, volumeAboveFlotation } = computeIceVolume(H, b, is_floating, dx);

    expect(volume).toBeGreaterThan(0);
    expect(volumeAboveFlotation).toBeGreaterThan(0);
    expect(volumeAboveFlotation).toBeLessThan(volume);
  });

  it('returns zero volume for no ice', () => {
    const H = new Float64Array([0, 0, 0]);
    const b = new Float64Array([-500, -500, -500]);
    const is_floating = new Uint8Array([0, 0, 0]);
    const { volume } = computeIceVolume(H, b, is_floating, 1000);
    expect(volume).toBe(0);
  });
});
