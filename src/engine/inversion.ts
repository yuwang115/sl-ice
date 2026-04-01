/**
 * Robin-type iterative basal friction inversion.
 *
 * Given observed surface velocity u_obs(x) along a flowline, this module
 * derives a spatially-varying basal friction coefficient C(x) that, when
 * used in the Blatter–Pattyn solver, reproduces the observed velocities.
 *
 * Algorithm (fixed-point iteration):
 *   1. Start with C(x) = C_SLIDING (uniform)
 *   2. Solve BP → extract surface velocity u_model(x)
 *   3. Update: C_new = C_old · (u_obs / u_model)^α   (α = 0.5)
 *   4. Clamp to [C_MIN, C_MAX], apply Gaussian smoothing
 *   5. Check convergence: normalised RMS misfit < tolerance
 *
 * Physics: if u_model > u_obs the ice is too fast, so we increase C to
 * add more basal drag; if too slow, we decrease C.
 */

import {
  C_SLIDING,
  C_BASAL_MIN, C_BASAL_MAX,
  INVERSION_ALPHA, INVERSION_MAX_ITER, INVERSION_TOL,
} from './constants';
import { solveBP, surfaceVelocity } from './bp-solver';
import type { ModelState } from './types';

/**
 * 3-point Gaussian smoothing kernel [0.25, 0.5, 0.25].
 * Prevents checkerboard oscillations in the inverted C field.
 * No-flux boundaries (mirror edge values).
 */
function gaussianSmooth(arr: Float64Array): Float64Array {
  const n = arr.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const left = i > 0 ? arr[i - 1] : arr[i];
    const right = i < n - 1 ? arr[i + 1] : arr[i];
    out[i] = 0.25 * left + 0.5 * arr[i] + 0.25 * right;
  }
  return out;
}

/**
 * Compute normalised RMS misfit between modelled and observed velocity.
 * Only considers grounded nodes with u_obs > 0.
 */
function normalisedRMS(
  u_model: Float64Array,
  u_obs: Float64Array,
  is_floating: Uint8Array,
): number {
  let sumSq = 0;
  let sumObs = 0;
  let count = 0;

  for (let i = 0; i < u_obs.length; i++) {
    if (is_floating[i] || u_obs[i] < 1) continue;
    const diff = u_model[i] - u_obs[i];
    sumSq += diff * diff;
    sumObs += u_obs[i];
    count++;
  }

  if (count === 0) return 0;
  return Math.sqrt(sumSq / count) / (sumObs / count);
}

/**
 * Invert basal friction coefficient C(x) from observed surface velocity.
 *
 * @param state    Current model state (will be temporarily mutated then restored)
 * @param u_obs    Observed surface speed at each grid node (m/yr)
 * @param T_atm_base  Base atmospheric temperature for viscosity calculation
 * @returns        Inverted C(x) array of length nx
 */
export function invertBasalFriction(
  state: ModelState,
  u_obs: Float64Array,
  T_atm_base: number,
): Float64Array {
  const { nx, nz } = state.grid;

  // Initialise C(x) with the global constant
  let C: Float64Array = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    if (state.is_floating[i]) {
      C[i] = 0;
    } else if (u_obs[i] < 1) {
      // Near-zero observed velocity → frozen bed
      C[i] = C_BASAL_MAX;
    } else {
      C[i] = C_SLIDING;
    }
  }

  // Save original C_basal so we can restore after inversion
  const originalCBasal = state.C_basal;

  for (let iter = 0; iter < INVERSION_MAX_ITER; iter++) {
    // Inject current C(x) into state for the BP solver
    state.C_basal = C;

    // Solve forward problem
    const u2d = solveBP(state, T_atm_base);
    const u_surf = surfaceVelocity(u2d, nx, nz);

    // Check convergence
    const misfit = normalisedRMS(u_surf, u_obs, state.is_floating);
    if (misfit < INVERSION_TOL) {
      break;
    }

    // Update C using fixed-point rule
    const C_new = new Float64Array(nx);
    for (let i = 0; i < nx; i++) {
      if (state.is_floating[i]) {
        C_new[i] = 0;
        continue;
      }

      if (u_obs[i] < 1) {
        C_new[i] = C_BASAL_MAX;
        continue;
      }

      const u_m = Math.max(u_surf[i], 1.0); // Prevent division by zero
      const ratio = u_obs[i] / u_m;
      // ratio > 1 → model too slow → decrease C (less friction)
      // ratio < 1 → model too fast → increase C (more friction)
      C_new[i] = C[i] * Math.pow(ratio, INVERSION_ALPHA);

      // Clamp to physical bounds
      C_new[i] = Math.max(C_BASAL_MIN, Math.min(C_BASAL_MAX, C_new[i]));
    }

    // Gaussian smoothing
    C = gaussianSmooth(C_new);

    // Re-clamp after smoothing and enforce floating = 0
    for (let i = 0; i < nx; i++) {
      if (state.is_floating[i]) {
        C[i] = 0;
      } else {
        C[i] = Math.max(C_BASAL_MIN, Math.min(C_BASAL_MAX, C[i]));
      }
    }

    // Ice divide: copy from first interior grounded node
    if (!state.is_floating[0] && nx > 1) {
      C[0] = C[1];
    }
  }

  // Restore original state (inversion is a pre-processing step)
  state.C_basal = originalCBasal;

  return C;
}
