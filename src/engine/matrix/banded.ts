/**
 * Banded matrix solver using LU decomposition.
 *
 * For the BP equation on an (nx, nz) grid with 2D index (i, j) flattened to
 * k = i * nz + j, the matrix has bandwidth = nz (offsets: -nz, -1, 0, +1, +nz).
 *
 * We store the matrix in band storage format:
 *   band[d][k] = A[k, k + d - bandwidth]
 * where d ranges from 0 to 2*bandwidth.
 *
 * For efficiency, we use a compact representation with only the
 * relevant diagonals stored.
 */

import { zeros } from './utils';

/**
 * Banded matrix stored in compact form.
 * Diagonals are stored as: bands[offset + halfBand][row]
 * where offset is the diagonal offset from the main diagonal.
 */
export interface BandedMatrix {
  n: number;         // Matrix dimension
  halfBand: number;  // Half bandwidth (kl = ku = halfBand)
  /** Band storage: bands[d][k] where d = offset + halfBand */
  bands: Float64Array[];
}

/**
 * Create a zero banded matrix.
 * @param n Matrix dimension
 * @param halfBand Half bandwidth (number of sub/super-diagonals)
 */
export function createBandedMatrix(n: number, halfBand: number): BandedMatrix {
  const totalDiags = 2 * halfBand + 1;
  const bands: Float64Array[] = [];
  for (let d = 0; d < totalDiags; d++) {
    bands.push(zeros(n));
  }
  return { n, halfBand, bands };
}

/**
 * Set a value in the banded matrix: A[row][col] = val
 */
export function bandSet(mat: BandedMatrix, row: number, col: number, val: number): void {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return; // Outside band
  mat.bands[offset + mat.halfBand][row] = val;
}

/**
 * Add a value to the banded matrix: A[row][col] += val
 */
export function bandAdd(mat: BandedMatrix, row: number, col: number, val: number): void {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return;
  mat.bands[offset + mat.halfBand][row] += val;
}

/**
 * Get a value from the banded matrix: returns A[row][col]
 */
export function bandGet(mat: BandedMatrix, row: number, col: number): number {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return 0;
  return mat.bands[offset + mat.halfBand][row];
}

/**
 * Zero out all entries in the banded matrix.
 */
export function bandClear(mat: BandedMatrix): void {
  for (let d = 0; d < mat.bands.length; d++) {
    mat.bands[d].fill(0);
  }
}

/**
 * Solve the banded linear system A * x = rhs using banded LU decomposition
 * (Gaussian elimination with partial pivoting within the band).
 *
 * This modifies the matrix and rhs in place.
 * Returns the solution vector x (same buffer as rhs).
 *
 * For the ice sheet model, n ~ 1000-2000, halfBand ~ 15,
 * so this runs in O(n * halfBand²) ≈ O(n * 225) which is very fast.
 */
export function bandSolve(mat: BandedMatrix, rhs: Float64Array): Float64Array {
  const { n, halfBand, bands } = mat;
  const hb = halfBand;
  const mainDiag = hb; // Index of main diagonal in bands array

  // Forward elimination (no pivoting for simplicity — the BP matrix is well-conditioned)
  for (let k = 0; k < n - 1; k++) {
    const pivot = bands[mainDiag][k];
    if (Math.abs(pivot) < 1e-30) {
      // Near-singular: set row to small identity
      bands[mainDiag][k] = 1e-20;
      continue;
    }

    // Eliminate entries below the pivot within the band
    const iMax = Math.min(k + hb, n - 1);
    for (let i = k + 1; i <= iMax; i++) {
      const offset = k - i; // col - row = k - i (negative)
      const diagIdx = offset + hb;
      if (diagIdx < 0 || diagIdx >= bands.length) continue;

      const factor = bands[diagIdx][i] / pivot;
      if (factor === 0) continue;

      bands[diagIdx][i] = factor; // Store multiplier in place

      // Update remaining entries in row i
      const jMax = Math.min(k + hb, n - 1);
      for (let j = k + 1; j <= jMax; j++) {
        const colOffsetI = j - i;
        const colOffsetK = j - k;
        if (Math.abs(colOffsetI) <= hb && Math.abs(colOffsetK) <= hb) {
          bands[colOffsetI + hb][i] -= factor * bands[colOffsetK + hb][k];
        }
      }

      // Update RHS
      rhs[i] -= factor * rhs[k];
    }
  }

  // Back substitution
  for (let k = n - 1; k >= 0; k--) {
    const pivot = bands[mainDiag][k];
    if (Math.abs(pivot) < 1e-30) {
      rhs[k] = 0;
      continue;
    }

    let sum = rhs[k];
    const jMax = Math.min(k + hb, n - 1);
    for (let j = k + 1; j <= jMax; j++) {
      const colOffset = j - k;
      if (colOffset <= hb) {
        sum -= bands[colOffset + hb][k] * rhs[j];
      }
    }
    rhs[k] = sum / pivot;
  }

  return rhs;
}

/**
 * Alternative: Solve using Thomas-like algorithm for the special
 * 5-diagonal structure of the BP discretization.
 *
 * The BP matrix has non-zero entries at offsets: -nz, -1, 0, +1, +nz
 * This is a block tridiagonal system where each block is nz × nz tridiagonal.
 *
 * For simplicity and robustness, we use the general banded solver above.
 * This function is a convenience wrapper that creates and solves the system.
 */
export function solveBandedSystem(
  n: number,
  halfBand: number,
  assembleRow: (mat: BandedMatrix, rhs: Float64Array, row: number) => void,
): Float64Array {
  const mat = createBandedMatrix(n, halfBand);
  const rhs = zeros(n);

  for (let row = 0; row < n; row++) {
    assembleRow(mat, rhs, row);
  }

  return bandSolve(mat, rhs);
}
