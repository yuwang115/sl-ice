/**
 * Banded matrix storage and direct solvers.
 *
 * For the BP equation on an (nx, nz) grid with 2D index (i, j) flattened to
 * k = i * nz + j, the matrix has half-bandwidth nz (non-zero diagonals at
 * offsets -nz, -1, 0, +1, +nz).
 *
 * Storage is row-major and contiguous: A[row][col] lives at
 *   data[row * width + (col - row + halfBand)],   width = 2 * halfBand + 1
 * so the inner elimination loop walks two contiguous slices.
 */

/** Pivots smaller than this (in absolute value) are treated as singular. */
const SINGULAR_PIVOT = 1e-300;

/**
 * Banded matrix stored in compact row-major form.
 */
export interface BandedMatrix {
  n: number;         // Matrix dimension
  halfBand: number;  // Half bandwidth (kl = ku = halfBand)
  width: number;     // Row stride of `data` (2 * halfBand + 1)
  /** Row-major band storage: A[row][col] = data[row * width + col - row + halfBand] */
  data: Float64Array;
}

/**
 * Create a zero banded matrix.
 * @param n Matrix dimension
 * @param halfBand Half bandwidth (number of sub/super-diagonals)
 */
export function createBandedMatrix(n: number, halfBand: number): BandedMatrix {
  const width = 2 * halfBand + 1;
  return { n, halfBand, width, data: new Float64Array(n * width) };
}

/**
 * Set a value in the banded matrix: A[row][col] = val
 */
export function bandSet(mat: BandedMatrix, row: number, col: number, val: number): void {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return; // Outside band
  mat.data[row * mat.width + offset + mat.halfBand] = val;
}

/**
 * Add a value to the banded matrix: A[row][col] += val
 */
export function bandAdd(mat: BandedMatrix, row: number, col: number, val: number): void {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return;
  mat.data[row * mat.width + offset + mat.halfBand] += val;
}

/**
 * Get a value from the banded matrix: returns A[row][col]
 */
export function bandGet(mat: BandedMatrix, row: number, col: number): number {
  const offset = col - row;
  if (Math.abs(offset) > mat.halfBand) return 0;
  return mat.data[row * mat.width + offset + mat.halfBand];
}

/**
 * Zero out all entries in the banded matrix.
 */
export function bandClear(mat: BandedMatrix): void {
  mat.data.fill(0);
}

/**
 * Replace a (numerically) singular pivot row by the identity row x_k = 0.
 * Keeps the factorisation finite instead of propagating Inf/NaN; callers
 * only hit this for degenerate systems (e.g. a detached, unanchored block).
 */
function regularizePivotRow(
  data: Float64Array,
  rowBase: number,
  diagIdx: number,
  rowEnd: number,
  rhs: Float64Array,
  k: number,
): void {
  data[rowBase + diagIdx] = 1;
  for (let c = diagIdx + 1; c < rowEnd; c++) data[rowBase + c] = 0;
  rhs[k] = 0;
}

/**
 * Solve A·x = rhs by banded Gaussian elimination WITHOUT pivoting.
 *
 * Valid for (weakly) row diagonally dominant matrices such as the BP
 * system: Gaussian elimination is then backward stable with growth factor
 * ≤ 2 (Wilkinson), and no fill-in occurs outside the original band.
 *
 * Modifies `mat` and `rhs` in place; returns the solution (same buffer as rhs).
 */
export function bandSolveNoPivot(mat: BandedMatrix, rhs: Float64Array): Float64Array {
  const { n, halfBand: hb, width, data } = mat;

  for (let k = 0; k < n; k++) {
    const kBase = k * width - k + hb; // data[kBase + col] = A[k][col]
    let pivot = data[kBase + k];
    if (!(Math.abs(pivot) > SINGULAR_PIVOT)) {
      regularizePivotRow(data, k * width, hb, width, rhs, k);
      pivot = 1;
    }

    const iMax = Math.min(k + hb, n - 1);
    const jMax = Math.min(k + hb, n - 1);
    const rhsK = rhs[k];
    for (let i = k + 1; i <= iMax; i++) {
      const iBase = i * width - i + hb;
      const a = data[iBase + k];
      if (a === 0) continue;
      const factor = a / pivot;
      data[iBase + k] = 0;
      for (let j = k + 1; j <= jMax; j++) {
        data[iBase + j] -= factor * data[kBase + j];
      }
      rhs[i] -= factor * rhsK;
    }
  }

  for (let k = n - 1; k >= 0; k--) {
    const kBase = k * width - k + hb;
    let sum = rhs[k];
    const jMax = Math.min(k + hb, n - 1);
    for (let j = k + 1; j <= jMax; j++) {
      sum -= data[kBase + j] * rhs[j];
    }
    rhs[k] = sum / data[kBase + k];
  }

  return rhs;
}

/**
 * Solve A·x = rhs by banded Gaussian elimination WITH partial pivoting.
 *
 * Row interchanges widen the upper band of U from halfBand to 2·halfBand
 * (LAPACK dgbtrf layout), so the factorisation runs in a work array with
 * that extra fill-in room. `mat` is left untouched; the solution is
 * written into `rhs`, which is also returned.
 */
export function bandSolve(mat: BandedMatrix, rhs: Float64Array): Float64Array {
  const { n, halfBand: hb, width: srcWidth, data: src } = mat;
  // Work storage: offsets -hb..+2hb → width 3hb+1, diagonal at column hb.
  const width = 3 * hb + 1;
  const work = new Float64Array(n * width);
  for (let r = 0; r < n; r++) {
    work.set(src.subarray(r * srcWidth, (r + 1) * srcWidth), r * width);
  }
  // Entry (row, col) lives at work[row * width + col - row + hb].
  const at = (row: number, col: number) => row * width + col - row + hb;

  for (let k = 0; k < n; k++) {
    const iMax = Math.min(k + hb, n - 1);

    let pivotRow = k;
    let maxVal = Math.abs(work[at(k, k)]);
    for (let i = k + 1; i <= iMax; i++) {
      const v = Math.abs(work[at(i, k)]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = i;
      }
    }

    // Columns that can be non-zero in either row: k .. k + 2hb.
    const jMax = Math.min(k + 2 * hb, n - 1);
    if (pivotRow !== k) {
      for (let j = k; j <= jMax; j++) {
        const a = at(k, j);
        const b = at(pivotRow, j);
        const tmp = work[a];
        work[a] = work[b];
        work[b] = tmp;
      }
      const tmp = rhs[k];
      rhs[k] = rhs[pivotRow];
      rhs[pivotRow] = tmp;
    }

    let pivot = work[at(k, k)];
    if (!(Math.abs(pivot) > SINGULAR_PIVOT)) {
      regularizePivotRow(work, k * width, hb, width, rhs, k);
      pivot = 1;
    }

    for (let i = k + 1; i <= iMax; i++) {
      const ik = at(i, k);
      const a = work[ik];
      if (a === 0) continue;
      const factor = a / pivot;
      work[ik] = 0;
      for (let j = k + 1; j <= jMax; j++) {
        work[at(i, j)] -= factor * work[at(k, j)];
      }
      rhs[i] -= factor * rhs[k];
    }
  }

  for (let k = n - 1; k >= 0; k--) {
    let sum = rhs[k];
    const jMax = Math.min(k + 2 * hb, n - 1);
    for (let j = k + 1; j <= jMax; j++) {
      sum -= work[at(k, j)] * rhs[j];
    }
    rhs[k] = sum / work[at(k, k)];
  }

  return rhs;
}
