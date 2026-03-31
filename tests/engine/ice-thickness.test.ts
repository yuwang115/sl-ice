import { describe, it, expect } from 'vitest';
import { evolveThickness, applyCalving } from '../../src/engine/ice-thickness';
import { H_MIN, H_MAX } from '../../src/engine/constants';
import type { ModelGrid } from '../../src/engine/types';

function makeGrid(nx: number, dx: number): ModelGrid {
  const nz = 5;
  const x = new Float64Array(nx);
  const sigma = new Float64Array(nz);
  for (let i = 0; i < nx; i++) x[i] = i * dx;
  for (let j = 0; j < nz; j++) sigma[j] = j / (nz - 1);
  return { nx, nz, dx, dsigma: 1 / (nz - 1), x, sigma };
}

describe('evolveThickness', () => {
  it('accumulation increases thickness when velocity is zero', () => {
    const nx = 5;
    const dx = 2000;
    const grid = makeGrid(nx, dx);
    const H = new Float64Array(nx).fill(1000);
    const u_avg = new Float64Array(nx).fill(0);
    const smb = new Float64Array(nx).fill(0.5); // 0.5 m/yr accumulation
    const basal_melt = new Float64Array(nx).fill(0);
    const dt = 1.0;

    const H_new = evolveThickness(H, u_avg, smb, basal_melt, grid, dt);

    for (let i = 0; i < nx; i++) {
      expect(H_new[i]).toBeGreaterThan(H[i]);
      expect(H_new[i]).toBeCloseTo(1000.5, 1);
    }
  });

  it('basal melt decreases thickness', () => {
    const nx = 5;
    const dx = 2000;
    const grid = makeGrid(nx, dx);
    const H = new Float64Array(nx).fill(1000);
    const u_avg = new Float64Array(nx).fill(0);
    const smb = new Float64Array(nx).fill(0);
    const basal_melt = new Float64Array(nx).fill(2.0);
    const dt = 1.0;

    const H_new = evolveThickness(H, u_avg, smb, basal_melt, grid, dt);

    for (let i = 0; i < nx; i++) {
      expect(H_new[i]).toBeLessThan(H[i]);
    }
  });

  it('clamps thickness to H_MAX', () => {
    const nx = 3;
    const dx = 2000;
    const grid = makeGrid(nx, dx);
    const H = new Float64Array(nx).fill(H_MAX - 1);
    const u_avg = new Float64Array(nx).fill(0);
    const smb = new Float64Array(nx).fill(1000); // extreme accumulation
    const basal_melt = new Float64Array(nx).fill(0);
    const dt = 1.0;

    const H_new = evolveThickness(H, u_avg, smb, basal_melt, grid, dt);

    for (let i = 0; i < nx; i++) {
      expect(H_new[i]).toBeLessThanOrEqual(H_MAX);
    }
  });

  it('sets thickness to 0 when it falls below H_MIN', () => {
    const nx = 3;
    const dx = 2000;
    const grid = makeGrid(nx, dx);
    const H = new Float64Array(nx).fill(H_MIN + 1);
    const u_avg = new Float64Array(nx).fill(0);
    const smb = new Float64Array(nx).fill(-100); // massive melt
    const basal_melt = new Float64Array(nx).fill(0);
    const dt = 1.0;

    const H_new = evolveThickness(H, u_avg, smb, basal_melt, grid, dt);

    for (let i = 0; i < nx; i++) {
      expect(H_new[i]).toBe(0);
    }
  });

  it('conserves mass approximately for uniform flow', () => {
    const nx = 50;
    const dx = 2000;
    const grid = makeGrid(nx, dx);
    const H = new Float64Array(nx).fill(1000);
    const u_avg = new Float64Array(nx).fill(100); // uniform 100 m/yr
    const smb = new Float64Array(nx).fill(0);
    const basal_melt = new Float64Array(nx).fill(0);
    const dt = 0.1;

    const H_new = evolveThickness(H, u_avg, smb, basal_melt, grid, dt);

    // Interior points should be largely unchanged (uniform flow → dF/dx ≈ 0)
    for (let i = 2; i < nx - 2; i++) {
      expect(Math.abs(H_new[i] - 1000)).toBeLessThan(1);
    }
  });
});

describe('applyCalving', () => {
  it('removes thin floating ice from the ocean end', () => {
    const H = new Float64Array([2000, 1000, 500, 30, 10]);
    const is_floating = new Uint8Array([0, 0, 1, 1, 1]);

    const { H: calved, calved: didCalve } = applyCalving(H, is_floating);

    expect(didCalve).toBe(true);
    expect(calved[3]).toBe(0); // thin floating ice removed
    expect(calved[4]).toBe(0);
    expect(calved[2]).toBe(500); // thick floating ice preserved
  });

  it('does not calve substantial floating ice', () => {
    const H = new Float64Array([2000, 1000, 500, 200, 100]);
    const is_floating = new Uint8Array([0, 0, 1, 1, 1]);

    const { calved } = applyCalving(H, is_floating);
    expect(calved).toBe(false);
  });

  it('does not modify grounded ice', () => {
    const H = new Float64Array([2000, 1000, 500]);
    const is_floating = new Uint8Array([0, 0, 0]);

    const { H: calved, calved: didCalve } = applyCalving(H, is_floating);
    expect(didCalve).toBe(false);
    expect(calved[0]).toBe(2000);
    expect(calved[1]).toBe(1000);
    expect(calved[2]).toBe(500);
  });
});
