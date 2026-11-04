import { describe, it, expect } from 'vitest';
import {
  createBandedMatrix,
  bandSet,
  bandGet,
  bandAdd,
  bandClear,
  bandSolve,
  bandSolveNoPivot,
} from '../../src/engine/matrix/banded';

describe('BandedMatrix operations', () => {
  it('creates a zero matrix', () => {
    const mat = createBandedMatrix(5, 2);
    expect(mat.n).toBe(5);
    expect(mat.halfBand).toBe(2);
    expect(mat.width).toBe(5); // 2*2+1
    expect(mat.data.length).toBe(25);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(bandGet(mat, r, c)).toBe(0);
      }
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

/** Dense Gaussian elimination with partial pivoting (reference solver). */
function denseSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let k = n - 1; k >= 0; k--) {
    let s = M[k][n];
    for (let j = k + 1; j < n; j++) s -= M[k][j] * x[j];
    x[k] = s / M[k][k];
  }
  return x;
}

/**
 * BP-shaped system (nx columns × nz levels): identity rows at the divide,
 * [1, -1] free-slip/surface rows and 5-point interior rows. Unit-scaled BC
 * rows next to large interior coefficients force row swaps under partial
 * pivoting, which create fill-in beyond the original upper band.
 */
function bpShapedSystem(nx: number, nz: number) {
  const n = nx * nz;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const rhs = new Array<number>(n).fill(0);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const k = i * nz + j;
      if (i === 0) { A[k][k] = 1; continue; }
      if (j === nz - 1) { A[k][k] = 1; A[k][k - 1] = -1; continue; }
      if (j === 0) { A[k][k] = 1; A[k][k + 1] = -1; continue; }
      const cx = 3 + Math.sin(i);
      const cs = 1000 + 100 * Math.cos(i + j);
      const cxr = i < nx - 1 ? cx : 0;
      A[k][k] = -(cx + cxr + 2 * cs);
      A[k][k - nz] = cx;
      if (i < nx - 1) A[k][k + nz] = cxr;
      A[k][k - 1] = cs;
      A[k][k + 1] = cs;
      rhs[k] = -1 - 0.1 * i;
    }
  }
  const mat = createBandedMatrix(n, nz);
  for (let r = 0; r < n; r++) {
    for (let c = Math.max(0, r - nz); c <= Math.min(n - 1, r + nz); c++) {
      if (A[r][c] !== 0) bandSet(mat, r, c, A[r][c]);
    }
  }
  return { A, rhs, mat, n };
}

function relativeError(x: Float64Array, ref: number[]): number {
  let err = 0;
  let norm = 0;
  for (let i = 0; i < ref.length; i++) {
    err += (x[i] - ref[i]) ** 2;
    norm += ref[i] ** 2;
  }
  return Math.sqrt(err / norm);
}

describe('banded solvers on BP-shaped systems', () => {
  it('bandSolve keeps fill-in created by row swaps (matches dense GEPP)', () => {
    const { A, rhs, mat } = bpShapedSystem(12, 6);
    const x = bandSolve(mat, Float64Array.from(rhs));
    expect(relativeError(x, denseSolve(A, rhs))).toBeLessThan(1e-10);
  });

  it('bandSolve leaves the input matrix untouched', () => {
    const { mat } = bpShapedSystem(4, 3);
    const before = Float64Array.from(mat.data);
    bandSolve(mat, new Float64Array(mat.n).fill(1));
    expect(Array.from(mat.data)).toEqual(Array.from(before));
  });

  it('bandSolveNoPivot solves diagonally dominant BP systems accurately', () => {
    const { A, rhs, mat } = bpShapedSystem(12, 6);
    const x = bandSolveNoPivot(mat, Float64Array.from(rhs));
    expect(relativeError(x, denseSolve(A, rhs))).toBeLessThan(1e-8);
  });
});
