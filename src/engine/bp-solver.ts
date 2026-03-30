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
 * Bandwidth = nz (diagonals at offsets -nz, -1, 0, +1, +nz).
 */

import {
  RHO_ICE, G,
  PICARD_TOL, PICARD_MAX_ITER, PICARD_OMEGA,
  C_SLIDING, SLIDING_M, RHO_WATER, H_MIN, U_MAX,
} from './constants';
import {
  createBandedMatrix, bandSet, bandAdd, bandSolve, bandClear,
} from './matrix/banded';
import { zeros, relDiff, copyArray } from './matrix/utils';
import { computeViscosityField } from './temperature';
import { subElementFriction } from './grounding-line';
import type { ModelState } from './types';

/**
 * Solve the BP velocity field using Picard iteration.
 *
 * @param state Current model state (contains H, b, s, u, etc.)
 * @param params User parameters
 * @param T_atm_base Base atmospheric temperature
 * @returns Updated velocity field u (nx * nz)
 */
export function solveBP(
  state: ModelState,
  T_atm_base: number,
): Float64Array {
  const { grid, H, b, s, u, smb, N_eff, is_floating, gl_index, gl_position, params } = state;
  const { nx, nz, dx, dsigma } = grid;
  const n_total = nx * nz;
  const halfBand = nz; // Bandwidth from x-direction coupling

  // Initialize with previous velocity
  let u_current = copyArray(u);
  let u_next = zeros(n_total);
  const mat = createBandedMatrix(n_total, halfBand);
  const rhs = zeros(n_total);

  for (let iter = 0; iter < PICARD_MAX_ITER; iter++) {
    bandClear(mat);
    rhs.fill(0);

    // 1. Compute viscosity from current velocity
    const eta = computeViscosityField(
      u_current, H, s, smb, grid, params, T_atm_base
    );

    // 2. Assemble linear system

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const k = i * nz + j;

        // ── Boundary: ice divide (i = 0): u = 0 (symmetry) ──
        if (i === 0) {
          bandSet(mat, k, k, 1.0);
          rhs[k] = 0;
          continue;
        }

        // ── Skip if no ice ──
        if (H[i] < H_MIN) {
          bandSet(mat, k, k, 1.0);
          rhs[k] = 0;
          continue;
        }

        // ── Surface BC (j = nz-1): stress-free, du/dσ = 0 ──
        if (j === nz - 1) {
          bandSet(mat, k, k, 1.0);
          // du/dσ = 0 → u[i,nz-1] = u[i,nz-2]
          if (nz > 1) {
            bandSet(mat, k, k - 1, -1.0);
          }
          rhs[k] = 0;
          continue;
        }

        // ── Basal BC (j = 0): sliding law or free slip ──
        if (j === 0) {
          const frictionFactor = subElementFriction(i, gl_index, gl_position, dx);

          if (frictionFactor < 1e-6 || is_floating[i]) {
            // Free slip (floating or no friction): du/dσ = 0
            bandSet(mat, k, k, 1.0);
            if (nz > 1) {
              bandSet(mat, k, k + 1, -1.0);
            }
            rhs[k] = 0;
          } else {
            // Sliding law: η/H * du/dσ = -C * u_b^m * N^q * frictionFactor
            // Linearized: η/(H*dσ) * (u[i,1] - u[i,0]) = -β * u[i,0]
            // where β = C * |u_b|^(m-1) * N^q * frictionFactor
            const u_b = Math.abs(u_current[k]) + 1e-6; // Regularize
            const N = Math.max(N_eff[i], 0);
            const beta = C_SLIDING * Math.pow(u_b, SLIDING_M - 1) * N * frictionFactor;

            const eta_b = eta[k];
            const viscTerm = eta_b / (H[i] * dsigma);

            // eta/(H*dσ) * (u[i,1] - u[i,0]) + β * u[i,0] = 0
            // → (viscTerm + β) * u[i,0] - viscTerm * u[i,1] = 0
            bandSet(mat, k, k, viscTerm + beta);
            if (nz > 1) {
              bandSet(mat, k, k + 1, -viscTerm);
            }
            rhs[k] = 0;
          }
          continue;
        }

        // ── Interior points ──
        const Hi = H[i];
        const Hi2 = Hi * Hi;

        // Driving stress (RHS)
        let dsdx: number;
        if (i < nx - 1) {
          dsdx = (s[i + 1] - s[i - 1]) / (2 * dx);
        } else {
          dsdx = (s[i] - s[i - 1]) / dx;
        }
        const driving = RHO_ICE * G * dsdx;

        // --- x-direction: ∂/∂x(4η ∂u/∂x) ---
        // At (i-1,j) and (i+1,j), offset = ±nz
        const eta_left = 0.5 * (eta[(i - 1) * nz + j] + eta[k]);
        let eta_right: number;
        if (i < nx - 1) {
          eta_right = 0.5 * (eta[k] + eta[(i + 1) * nz + j]);
        } else {
          eta_right = eta[k];
        }

        const coeff_x_left = 4 * eta_left / (dx * dx);
        const coeff_x_right = (i < nx - 1) ? 4 * eta_right / (dx * dx) : 0;
        const coeff_x_center = -(coeff_x_left + coeff_x_right);

        // --- σ-direction: (1/H²) ∂/∂σ(η ∂u/∂σ) ---
        const eta_below = 0.5 * (eta[i * nz + (j - 1)] + eta[k]);
        const eta_above = 0.5 * (eta[k] + eta[i * nz + (j + 1)]);

        const coeff_s_below = eta_below / (Hi2 * dsigma * dsigma);
        const coeff_s_above = eta_above / (Hi2 * dsigma * dsigma);
        const coeff_s_center = -(coeff_s_below + coeff_s_above);

        // Assemble row k
        const diagCoeff = coeff_x_center + coeff_s_center;
        bandSet(mat, k, k, diagCoeff);

        // x-direction neighbors
        bandAdd(mat, k, (i - 1) * nz + j, coeff_x_left);
        if (i < nx - 1) {
          bandAdd(mat, k, (i + 1) * nz + j, coeff_x_right);
        }

        // σ-direction neighbors
        bandAdd(mat, k, i * nz + (j - 1), coeff_s_below);
        bandAdd(mat, k, i * nz + (j + 1), coeff_s_above);

        // RHS: driving stress
        rhs[k] = driving;

        // ── Calving front BC (i = nx-1): apply ocean back-pressure ──
        if (i === nx - 1) {
          // Instead of clearing, just adjust the RHS for the calving stress
          const D = is_floating[i]
            ? Math.min(Hi * RHO_ICE / RHO_WATER, Math.max(0, -b[i]))
            : 0;
          const calvingStress =
            (0.5 * RHO_ICE * G * Hi * Hi - 0.5 * RHO_WATER * G * D * D) / (Hi * dx);
          // Add calving stress as a Neumann contribution
          rhs[k] += calvingStress;
        }
      }
    }

    // 3. Solve the linear system
    const solved = bandSolve(mat, rhs);

    // 4. Relaxation + velocity cap
    for (let k = 0; k < n_total; k++) {
      let relaxed = PICARD_OMEGA * solved[k] + (1 - PICARD_OMEGA) * u_current[k];
      // Clamp: non-negative and CFL-safe
      if (relaxed < 0) relaxed = 0;
      if (relaxed > U_MAX) relaxed = U_MAX;
      // Guard against NaN/Inf from singular matrix
      if (!isFinite(relaxed)) relaxed = 0;
      u_next[k] = relaxed;
    }

    // 5. Check convergence
    const diff = relDiff(u_next, u_current);
    const previous = u_current;
    u_current = u_next;
    u_next = previous;

    if (diff < PICARD_TOL) {
      break;
    }
  }

  return u_current;
}

/**
 * Compute depth-averaged velocity from the 2D velocity field.
 */
export function depthAverageVelocity(
  u: Float64Array,
  nx: number,
  nz: number,
): Float64Array {
  const u_avg = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    let sum = 0;
    for (let j = 0; j < nz; j++) {
      sum += u[i * nz + j];
    }
    u_avg[i] = sum / nz;
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
