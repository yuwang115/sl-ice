/**
 * Blatter–Pattyn velocity solver for 2D flowline (x-z) configuration.
 *
 * Solves the BP momentum equation in σ-coordinates:
 *
 *   ∂/∂x(4η ∂u/∂x) + (1/H²) ∂/∂σ(η ∂u/∂σ) = ρᵢ g ∂s/∂x
 *
 * Using Picard iteration:
 *   1. Compute viscosity η from current velocity
 *   2. Assemble linear system A·u = f
 *   3. Solve banded linear system
 *   4. Check convergence, repeat
 *
 * Matrix structure: 2D grid (i,j) flattened to k = i*nz + j.
 * Bandwidth = nz (diagonals at offsets -nz, -1, 0, +1, +nz). Every row is
 * (weakly) diagonally dominant, so elimination needs no pivoting.
 *
 * Ice margins: any ice column whose neighbour holds no ice (the domain end,
 * a calving front that has retreated, or an upstream ice-free gap) gets the
 * hydrostatic margin stress as a known longitudinal flux instead of being
 * coupled to the zero-velocity ice-free cell.
 */

import {
  RHO_ICE, RHO_WATER, G, H_MIN, U_MAX,
  PICARD_TOL, PICARD_MAX_ITER, PICARD_OMEGA, C_SLIDING,
} from './constants';
import {
  createBandedMatrix, bandSet, bandAdd, bandSolveNoPivot, bandClear,
} from './matrix/banded';
import type { BandedMatrix } from './matrix/banded';
import { zeros, relDiff, copyArray } from './matrix/utils';
import { computeViscosityField } from './temperature';
import { subElementFriction } from './grounding-line';
import { basalDragCoefficient } from './friction';
import type { ModelState } from './types';

/**
 * Depth-averaged longitudinal deviatoric stress at an ice margin,
 *   4η ∂u/∂x = (½ ρᵢ g H² − ½ ρ_w g D²) / H,
 * with D the water depth against the face (the draft if floating,
 * −b for a grounded marine cliff, 0 on land). Positive = extension.
 */
export function marginStress(H: number, bed: number): number {
  const D = Math.min(H * RHO_ICE / RHO_WATER, Math.max(0, -bed));
  return (0.5 * RHO_ICE * G * H * H - 0.5 * RHO_WATER * G * D * D) / H;
}

/** True where a column carries enough ice to take part in the momentum balance. */
function hasIceAt(H: Float64Array, i: number): boolean {
  return i >= 0 && i < H.length && H[i] >= H_MIN;
}

/** Surface slope with one-sided differences next to ice-free cells. */
function surfaceSlope(state: ModelState, i: number, iceLeft: boolean, iceRight: boolean): number {
  const { s, grid } = state;
  if (iceLeft && iceRight) return (s[i + 1] - s[i - 1]) / (2 * grid.dx);
  if (iceLeft) return (s[i] - s[i - 1]) / grid.dx;
  return (s[i + 1] - s[i]) / grid.dx;
}

/** Basal row (j = 0): Weertman-type sliding, or free slip under floating ice. */
function assembleBasalRow(
  mat: BandedMatrix,
  state: ModelState,
  eta: Float64Array,
  uCurrent: Float64Array,
  i: number,
): void {
  const { H, b, N_eff, is_floating, grid } = state;
  const k = i * grid.nz;
  const frictionFactor = subElementFriction(i, H, b, is_floating);

  if (is_floating[i] || frictionFactor < 1e-6) {
    // Free slip: du/dσ = 0
    bandSet(mat, k, k, 1.0);
    bandSet(mat, k, k + 1, -1.0);
    return;
  }

  // η/(H dσ)·(u₁ − u₀) = β·u₀  with β = τ_b / u_b from the friction law
  const C_i = state.C_basal ? state.C_basal[i] : C_SLIDING;
  const beta = basalDragCoefficient(C_i, Math.abs(uCurrent[k]), N_eff[i], H[i]) * frictionFactor;
  const viscTerm = eta[k] / (H[i] * grid.dsigma);
  bandSet(mat, k, k, viscTerm + beta);
  bandSet(mat, k, k + 1, -viscTerm);
}

/** Interior row (0 < j < nz-1): x- and σ-diffusion plus driving stress. */
function assembleInteriorRow(
  mat: BandedMatrix,
  rhs: Float64Array,
  state: ModelState,
  eta: Float64Array,
  i: number,
  j: number,
  iceLeft: boolean,
  iceRight: boolean,
): void {
  const { H, b, grid } = state;
  const { nz, dx, dsigma } = grid;
  const k = i * nz + j;
  const Hi = H[i];

  let rowRhs = RHO_ICE * G * surfaceSlope(state, i, iceLeft, iceRight);
  let diag = 0;

  // x-direction: (Flux_{i+½} − Flux_{i−½}) / dx with Flux = 4η ∂u/∂x.
  // At a margin the flux is the known hydrostatic stress, moved to the RHS.
  const front = iceLeft && iceRight ? 0 : marginStress(Hi, b[i]);
  if (iceLeft) {
    const c = 2 * (eta[k - nz] + eta[k]) / (dx * dx); // 4·η̄/dx²
    bandAdd(mat, k, k - nz, c);
    diag -= c;
  } else {
    rowRhs += front / dx;
  }
  if (iceRight) {
    const c = 2 * (eta[k] + eta[k + nz]) / (dx * dx);
    bandAdd(mat, k, k + nz, c);
    diag -= c;
  } else {
    rowRhs -= front / dx;
  }

  // σ-direction: (1/H²) ∂/∂σ(η ∂u/∂σ)
  const sScale = 0.5 / (Hi * Hi * dsigma * dsigma);
  const cBelow = (eta[k - 1] + eta[k]) * sScale;
  const cAbove = (eta[k] + eta[k + 1]) * sScale;
  bandAdd(mat, k, k - 1, cBelow);
  bandAdd(mat, k, k + 1, cAbove);
  diag -= cBelow + cAbove;

  // Lateral (side-wall) drag on floating ice: −γ·u
  const gamma = state.is_floating[i] ? state.lateral_drag?.[i] ?? 0 : 0;
  if (gamma > 0) diag -= gamma;

  bandAdd(mat, k, k, diag);
  rhs[k] = rowRhs;
}

/**
 * Columns that take part in the momentum balance. The divide (i = 0),
 * ice-free columns and isolated single cells are pinned to u = 0.
 */
function activeColumns(H: Float64Array, nz: number): Uint8Array {
  const nx = H.length;
  const active = new Uint8Array(nx);
  for (let i = 1; i < nx; i++) {
    const connected = hasIceAt(H, i - 1) || hasIceAt(H, i + 1);
    active[i] = hasIceAt(H, i) && connected && nz > 1 ? 1 : 0;
  }
  return active;
}

/** Assemble the full BP system for the current viscosity field. */
function assembleSystem(
  mat: BandedMatrix,
  rhs: Float64Array,
  state: ModelState,
  eta: Float64Array,
  uCurrent: Float64Array,
  active: Uint8Array,
): void {
  const { H, grid } = state;
  const { nx, nz } = grid;
  bandClear(mat);
  rhs.fill(0);

  for (let i = 0; i < nx; i++) {
    const iceLeft = hasIceAt(H, i - 1);
    const iceRight = hasIceAt(H, i + 1);
    if (!active[i]) {
      for (let j = 0; j < nz; j++) bandSet(mat, i * nz + j, i * nz + j, 1.0);
      continue;
    }

    assembleBasalRow(mat, state, eta, uCurrent, i);
    for (let j = 1; j < nz - 1; j++) {
      assembleInteriorRow(mat, rhs, state, eta, i, j, iceLeft, iceRight);
    }
    // Surface (j = nz-1): stress-free, du/dσ = 0
    const kTop = i * nz + nz - 1;
    bandSet(mat, kTop, kTop, 1.0);
    bandSet(mat, kTop, kTop - 1, -1.0);
  }
}

/** Convergence diagnostics of the last Picard loop (filled when requested). */
export interface PicardStats {
  iterations: number;
  /** Relative change between the last two iterates. */
  residual: number;
}

/**
 * Solve the BP velocity field using Picard iteration.
 *
 * @param state Current model state (contains H, b, s, u, etc.)
 * @param T_atm_base Base atmospheric temperature
 * @param stats Optional object that receives convergence diagnostics
 * @returns Updated velocity field u (nx * nz)
 */
export function solveBP(
  state: ModelState,
  T_atm_base: number,
  stats?: PicardStats,
): Float64Array {
  const { grid, H, s, u, smb, params } = state;
  const { nx, nz } = grid;
  const n_total = nx * nz;

  const active = activeColumns(H, nz);
  let u_current = copyArray(u);
  // Pinned columns are exactly zero from the start (no relaxation residue).
  for (let i = 0; i < nx; i++) {
    if (!active[i]) u_current.fill(0, i * nz, (i + 1) * nz);
  }
  let u_next = zeros(n_total);
  const mat = createBandedMatrix(n_total, nz);
  const rhs = zeros(n_total);

  for (let iter = 0; iter < PICARD_MAX_ITER; iter++) {
    const eta = computeViscosityField(u_current, H, s, smb, grid, params, T_atm_base);
    assembleSystem(mat, rhs, state, eta, u_current, active);
    const solved = bandSolveNoPivot(mat, rhs);

    // Relaxation + velocity cap
    for (let k = 0; k < n_total; k++) {
      let relaxed = PICARD_OMEGA * solved[k] + (1 - PICARD_OMEGA) * u_current[k];
      // Clamp: non-negative and CFL-safe
      if (relaxed < 0) relaxed = 0;
      if (relaxed > U_MAX) relaxed = U_MAX;
      // Guard against NaN/Inf from a degenerate system
      if (!Number.isFinite(relaxed)) relaxed = 0;
      u_next[k] = relaxed;
    }

    const diff = relDiff(u_next, u_current);
    const previous = u_current;
    u_current = u_next;
    u_next = previous;

    if (stats) {
      stats.iterations = iter + 1;
      stats.residual = diff;
    }
    if (diff < PICARD_TOL) {
      break;
    }
  }

  return u_current;
}

/**
 * Compute depth-averaged velocity from the 2D velocity field
 * (trapezoidal rule over the uniform σ levels, endpoints half-weighted).
 */
export function depthAverageVelocity(
  u: Float64Array,
  nx: number,
  nz: number,
): Float64Array {
  const u_avg = new Float64Array(nx);
  if (nz < 2) {
    for (let i = 0; i < nx; i++) u_avg[i] = u[i * nz];
    return u_avg;
  }
  for (let i = 0; i < nx; i++) {
    const base = i * nz;
    let sum = 0.5 * (u[base] + u[base + nz - 1]);
    for (let j = 1; j < nz - 1; j++) {
      sum += u[base + j];
    }
    u_avg[i] = sum / (nz - 1);
  }
  return u_avg;
}

/**
 * Extract surface velocity from the 2D field.
 */
export function surfaceVelocity(
  u: Float64Array,
  nx: number,
  nz: number,
): Float64Array {
  const u_s = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    u_s[i] = u[i * nz + (nz - 1)]; // σ = 1 is surface
  }
  return u_s;
}

/**
 * Extract basal velocity from the 2D field.
 */
export function basalVelocity(
  u: Float64Array,
  nx: number,
  nz: number,
): Float64Array {
  const u_b = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    u_b[i] = u[i * nz]; // σ = 0 is bed
  }
  return u_b;
}
