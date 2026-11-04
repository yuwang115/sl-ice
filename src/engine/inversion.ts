/**
 * Robin-type iterative inversion of the flowline drag fields.
 *
 * Given observed surface velocity u_obs(x) along a flowline, this module
 * derives two spatially-varying coefficients that, when used in the
 * Blatter–Pattyn solver, reproduce the observed velocities:
 *   - C(x): Weertman basal friction under grounded ice
 *   - γ(x): lateral (side-wall) drag under floating ice, standing in for
 *           the embayment buttressing a 2D flowline cannot resolve
 *
 * Algorithm (fixed-point iteration, both fields updated together):
 *   1. Start with C = C_SLIDING, γ = LATERAL_DRAG_DEFAULT
 *   2. Solve BP → extract surface velocity u_model(x)
 *   3. Update: X_new = X_old · (u_model / u_obs)^α   (α = 0.5)
 *   4. Clamp to bounds, apply Gaussian smoothing
 *   5. Check convergence: normalised RMS misfit < tolerance
 *
 * Physics: if u_model > u_obs the ice is too fast, so we increase the drag;
 * if too slow, we decrease it.
 */

import {
  C_SLIDING,
  C_BASAL_MIN, C_BASAL_MAX,
  LATERAL_DRAG_DEFAULT, LATERAL_DRAG_MIN, LATERAL_DRAG_MAX,
  INVERSION_ALPHA, INVERSION_MAX_ITER, INVERSION_TOL,
} from './constants';
import { solveBP, surfaceVelocity } from './bp-solver';
import type { ModelState } from './types';

export interface DragFields {
  C_basal: Float64Array;
  lateral_drag: Float64Array;
}

/**
 * 3-point Gaussian smoothing kernel [0.25, 0.5, 0.25].
 * Prevents checkerboard oscillations in the inverted fields.
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
 * Normalised RMS misfit between modelled and observed velocity over the
 * nodes selected by `include` (and u_obs ≥ 1).
 */
function normalisedRMS(
  u_model: Float64Array,
  u_obs: Float64Array,
  include: (i: number) => boolean,
): number {
  let sumSq = 0;
  let sumObs = 0;
  let count = 0;

  for (let i = 0; i < u_obs.length; i++) {
    if (!include(i) || u_obs[i] < 1) continue;
    const diff = u_model[i] - u_obs[i];
    sumSq += diff * diff;
    sumObs += u_obs[i];
    count++;
  }

  if (count === 0) return 0;
  return Math.sqrt(sumSq / count) / (sumObs / count);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Overwrite every non-source node with the value of its nearest source node
 * (ties go upstream). Leaves `values` unchanged when there is no source.
 */
function fillNearest(values: Float64Array, isSource: (i: number) => boolean): void {
  const n = values.length;
  const left = new Int32Array(n).fill(-1);
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (isSource(i)) last = i;
    left[i] = last;
  }
  let next = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (isSource(i)) {
      next = i;
      continue;
    }
    const l = left[i];
    const useLeft = l >= 0 && (next < 0 || i - l <= next - i);
    if (useLeft) values[i] = values[l];
    else if (next >= 0) values[i] = values[next];
  }
}

/**
 * One fixed-point update: ratio > 1 → model too fast → raise the drag.
 * Grounded nodes update C, floating nodes update γ.
 */
function updateDrag(
  fields: DragFields,
  u_surf: Float64Array,
  u_obs: Float64Array,
  is_floating: Uint8Array,
): DragFields {
  const nx = u_obs.length;
  const C = new Float64Array(fields.C_basal);
  const gamma = new Float64Array(fields.lateral_drag);
  for (let i = 0; i < nx; i++) {
    if (!is_floating[i] && u_obs[i] < 1) {
      C[i] = C_BASAL_MAX; // near-zero observed velocity → frozen bed
      continue;
    }
    if (u_obs[i] < 1) continue;
    const factor = Math.pow(Math.max(u_surf[i], 1.0) / u_obs[i], INVERSION_ALPHA);
    if (is_floating[i]) {
      gamma[i] = clamp(gamma[i] * factor, LATERAL_DRAG_MIN, LATERAL_DRAG_MAX);
    } else {
      C[i] = clamp(C[i] * factor, C_BASAL_MIN, C_BASAL_MAX);
    }
  }
  return { C_basal: C, lateral_drag: gamma };
}

/**
 * Smooth both fields. Each is first extended into the region where it is
 * inactive (C under floating ice, γ under grounded ice) so smoothing near
 * the grounding line does not mix in meaningless values — and so ice that
 * later re-grounds keeps friction, or newly floating ice keeps buttressing.
 */
function regularize(fields: DragFields, u_obs: Float64Array, is_floating: Uint8Array): DragFields {
  const grounded = (i: number) => !is_floating[i];
  const floating = (i: number) => is_floating[i] === 1;
  fillNearest(fields.C_basal, grounded);
  fillNearest(fields.lateral_drag, floating);

  const C = gaussianSmooth(fields.C_basal);
  const gamma = gaussianSmooth(fields.lateral_drag);
  for (let i = 0; i < C.length; i++) {
    // Frozen-bed nodes keep their hard assignment through smoothing.
    C[i] = grounded(i) && u_obs[i] < 1 ? C_BASAL_MAX : clamp(C[i], C_BASAL_MIN, C_BASAL_MAX);
    gamma[i] = clamp(gamma[i], LATERAL_DRAG_MIN, LATERAL_DRAG_MAX);
  }
  // Ice divide: copy from first interior grounded node
  if (grounded(0) && C.length > 1) C[0] = C[1];
  fillNearest(C, grounded);
  fillNearest(gamma, floating);
  return { C_basal: C, lateral_drag: gamma };
}

/**
 * Invert basal friction C(x) and lateral drag γ(x) from observed surface speed.
 *
 * @param state    Current model state. C_basal / lateral_drag are restored
 *                 afterwards; state.u is left at the last forward solution
 *                 (a better initial guess than the analytic one).
 * @param u_obs    Observed surface speed at each grid node (m/yr)
 * @param T_atm_base  Base atmospheric temperature for viscosity calculation
 */
export function invertDragFields(
  state: ModelState,
  u_obs: Float64Array,
  T_atm_base: number,
): DragFields {
  const { nx, nz } = state.grid;
  const { is_floating } = state;

  let fields: DragFields = {
    C_basal: new Float64Array(nx).fill(C_SLIDING),
    lateral_drag: new Float64Array(nx).fill(LATERAL_DRAG_DEFAULT),
  };
  for (let i = 0; i < nx; i++) {
    if (!is_floating[i] && u_obs[i] < 1) fields.C_basal[i] = C_BASAL_MAX;
  }

  const original = { C_basal: state.C_basal, lateral_drag: state.lateral_drag };

  for (let iter = 0; iter < INVERSION_MAX_ITER; iter++) {
    state.C_basal = fields.C_basal;
    state.lateral_drag = fields.lateral_drag;

    // Solve forward problem, warm-starting from the previous iterate
    state.u = solveBP(state, T_atm_base);
    const u_surf = surfaceVelocity(state.u, nx, nz);

    const groundedMisfit = normalisedRMS(u_surf, u_obs, (i) => !is_floating[i]);
    const floatingMisfit = normalisedRMS(u_surf, u_obs, (i) => is_floating[i] === 1);
    if (groundedMisfit < INVERSION_TOL && floatingMisfit < INVERSION_TOL) {
      break;
    }

    fields = regularize(updateDrag(fields, u_surf, u_obs, is_floating), u_obs, is_floating);
  }

  state.C_basal = original.C_basal;
  state.lateral_drag = original.lateral_drag;
  return fields;
}

/**
 * Invert basal friction coefficient C(x) from observed surface velocity.
 * Convenience wrapper around invertDragFields for callers that only need C.
 */
export function invertBasalFriction(
  state: ModelState,
  u_obs: Float64Array,
  T_atm_base: number,
): Float64Array {
  return invertDragFields(state, u_obs, T_atm_base).C_basal;
}
