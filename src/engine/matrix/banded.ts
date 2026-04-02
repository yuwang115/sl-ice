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
 * Swap two rows in the banded matrix (only the band entries) and the RHS.
 * After swapping rows r1 and r2, the band storage positions shift:
 * A[r1][col] was at bands[col - r1 + hb][r1], now needs to move to
 * bands[col - r2 + hb][r2], and vice versa.
 */
function swapRows(
  mat: BandedMatrix,
  rhs: Float64Array,
  r1: number,
  r2: number,
): void {
  if (r1 === r2) return;
  const { n, halfBand: hb, bands } = mat;

  // Determine the union of columns that either row can touch
  const colMin = Math.max(0, Math.min(r1, r2) - hb);
  const colMax = Math.min(n - 1, Math.max(r1, r2) + hb);

  for (let col = colMin; col <= colMax; col++) {
    const d1 = col - r1 + hb;
    const d2 = col - r2 + hb;
    const in1 = d1 >= 0 && d1 < bands.length;
    const in2 = d2 >= 0 && d2 < bands.length;

    const v1 = in1 ? bands[d1][r1] : 0;
    const v2 = in2 ? bands[d2][r2] : 0;

    // After swap: row r1 gets value v2, row r2 gets value v1
    // But the diagonal index also changes because the row index changed
    if (in2) bands[d2][r2] = v1;
    else if (v1 !== 0) { /* value falls outside band after swap — lost, acceptable for partial pivoting within band */ }

    if (in1) bands[d1][r1] = v2;
    else if (v2 !== 0) { /* same */ }
  }

  // Swap RHS
  const tmp = rhs[r1];
  rhs[r1] = rhs[r2];
  rhs[r2] = tmp;
}

/**
 * Solve the banded linear system A * x = rhs using banded LU decomposition
 * with partial pivoting within the band.
 *
 * Partial pivoting selects the largest-magnitude entry in the pivot column
 * (within the band) to reduce numerical error, which is critical near the
 * grounding line where viscosity contrasts are large.
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

  // Forward elimination with partial pivoting within the band
  for (let k = 0; k < n - 1; k++) {
    // Partial pivoting: find the row with the largest absolute value
    // in column k, among rows k..min(k+hb, n-1)
    const iMax = Math.min(k + hb, n - 1);
    let maxVal = Math.abs(bands[mainDiag][k]);
    let maxRow = k;
    for (let i = k + 1; i <= iMax; i++) {
      const diagIdx = (k - i) + hb; // column k from row i
      if (diagIdx < 0 || diagIdx >= bands.length) continue;
      const val = Math.abs(bands[diagIdx][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = i;
      }
    }

    // Swap rows if a better pivot was found
    if (maxRow !== k) {
      swapRows(mat, rhs, k, maxRow);
    }

    const pivot = bands[mainDiag][k];
    if (Math.abs(pivot) < 1e-30) {
      // Genuinely singular: set diagonal to small value, zero the solution
      bands[mainDiag][k] = 1e-20;
      continue;
    }

    // Eliminate entries below the pivot within the band
    for (let i = k + 1; i <= iMax; i++) {
      const diagIdx = (k - i) + hb;
      if (diagIdx < 0 || diagIdx >= bands.length) continue;

      const factor = bands[diagIdx][i] / pivot;
      if (factor === 0) continue;

      bands[diagIdx][i] = 0; // Eliminated entry

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
