import { describe, it, expect } from 'vitest';
import {
  createBandedMatrix,
  bandSet,
  bandGet,
  bandAdd,
  bandClear,
  bandSolve,
} from '../../src/engine/matrix/banded';

describe('BandedMatrix operations', () => {
  it('creates a zero matrix', () => {
    const mat = createBandedMatrix(5, 2);
    expect(mat.n).toBe(5);
    expect(mat.halfBand).toBe(2);
    expect(mat.bands.length).toBe(5); // 2*2+1
    for (const band of mat.bands) {
      expect(band.every((v) => v === 0)).toBe(true);
    }
  });

  it('sets and gets values correctly', () => {
    const mat = createBandedMatrix(5, 2);
    bandSet(mat, 1, 2, 3.14);
    expect(bandGet(mat, 1, 2)).toBeCloseTo(3.14);
    expect(bandGet(mat, 2, 1)).toBe(0); // different position
  });

  it('ignores out-of-band sets', () => {
    const mat = createBandedMatrix(5, 1);
    bandSet(mat, 0, 3, 99.9); // offset 3 > halfBand 1
    expect(bandGet(mat, 0, 3)).toBe(0);
  });

  it('adds values correctly', () => {
    const mat = createBandedMatrix(5, 2);
    bandSet(mat, 2, 3, 1.0);
    bandAdd(mat, 2, 3, 2.0);
    expect(bandGet(mat, 2, 3)).toBeCloseTo(3.0);
  });

  it('clears all entries', () => {
    const mat = createBandedMatrix(5, 2);
    bandSet(mat, 0, 0, 5.0);
    bandSet(mat, 1, 2, 3.0);
    bandClear(mat);
    expect(bandGet(mat, 0, 0)).toBe(0);
    expect(bandGet(mat, 1, 2)).toBe(0);
  });
});

describe('bandSolve', () => {
  it('solves a simple diagonal system', () => {
    // A = diag([2, 3, 4]), rhs = [4, 9, 16] → x = [2, 3, 4]
    const mat = createBandedMatrix(3, 1);
    bandSet(mat, 0, 0, 2);
    bandSet(mat, 1, 1, 3);
    bandSet(mat, 2, 2, 4);

    const rhs = new Float64Array([4, 9, 16]);
    const x = bandSolve(mat, rhs);

    expect(x[0]).toBeCloseTo(2);
    expect(x[1]).toBeCloseTo(3);
    expect(x[2]).toBeCloseTo(4);
  });

  it('solves a tridiagonal system correctly with partial pivoting', () => {
    // [2 -1  0] [x0]   [1]
    // [-1 2 -1] [x1] = [0]
    // [0 -1  2] [x2]   [1]
    // Exact solution: x = [1, 1, 1]
    // (verify: 2*1 - 1 = 1, -1 + 2 - 1 = 0, -1 + 2 = 1)
    const mat = createBandedMatrix(3, 1);
    bandSet(mat, 0, 0, 2); bandSet(mat, 0, 1, -1);
    bandSet(mat, 1, 0, -1); bandSet(mat, 1, 1, 2); bandSet(mat, 1, 2, -1);
    bandSet(mat, 2, 1, -1); bandSet(mat, 2, 2, 2);

    const rhs = new Float64Array([1, 0, 1]);
    const x = bandSolve(mat, rhs);

    expect(x[0]).toBeCloseTo(1.0, 10);
    expect(x[1]).toBeCloseTo(1.0, 10);
    expect(x[2]).toBeCloseTo(1.0, 10);
  });

  it('solves a system where pivoting is needed for accuracy', () => {
    // Small pivot on diagonal — without pivoting this would amplify error.
    // [1e-10  1] [x0]   [1]
    // [1      1] [x1] = [2]
    // Exact: x1 = (2 - 1/1e-10) / (1 - 1/1e-10) ≈ 1, x0 ≈ 1e10*(1-1) = 0...
    // More precisely: x1 = (2*1e-10 - 1) / (1e-10 - 1) ≈ 1.0, x0 = (1 - x1)/1e-10 ≈ 0
    // Exact solution: x0 = 1 / (1 - 1e-10) ≈ 1.0, x1 = 1 / (1 - 1e-10) ≈ 1.0
    // Let me use a clearer system:
    // [1e-15   1] [x0]   [1]
    // [1       1] [x1]   [2]
    // det = 1e-15 - 1 ≈ -1
    // x0 = (1 - 2) / (1e-15 - 1) = 1 / (1 - 1e-15) ≈ 1
    // x1 = (2*1e-15 - 1) / (1e-15 - 1) ≈ 1
    const mat = createBandedMatrix(2, 1);
    bandSet(mat, 0, 0, 1e-15);
    bandSet(mat, 0, 1, 1);
    bandSet(mat, 1, 0, 1);
    bandSet(mat, 1, 1, 1);

    const rhs = new Float64Array([1, 2]);
    const x = bandSolve(mat, rhs);

    expect(x[0]).toBeCloseTo(1.0, 8);
    expect(x[1]).toBeCloseTo(1.0, 8);
  });

  it('handles near-singular diagonal gracefully', () => {
    const mat = createBandedMatrix(2, 1);
    bandSet(mat, 0, 0, 1e-35); // near-zero pivot
    bandSet(mat, 1, 1, 2);

    const rhs = new Float64Array([1, 4]);
    const x = bandSolve(mat, rhs);

    // Should not throw, second element should be correct
    expect(Number.isFinite(x[1])).toBe(true);
    expect(x[1]).toBeCloseTo(2);
  });
});
