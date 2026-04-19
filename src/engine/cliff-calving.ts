/**
 * Marine Ice Cliff Instability (MICI) calving parameterization.
 *
 * Schlemm & Levermann (2019), The Cryosphere 13:2475–2488.
 *
 * When a buttressing ice shelf collapses, the exposed ice cliff at the
 * grounding line may exceed a critical freeboard height. Glaciostatic
 * stress then exceeds the yield strength of ice, causing structural
 * failure and rapid calving. On retrograde slopes this creates a
 * positive feedback: retreat exposes thicker ice → taller cliff → faster
 * calving.
 *
 * Calving rate:
 *   C = C_0 * ((F - F_t) / F_s)^s    for F > F_t
 *   C = 0                              for F <= F_t
 *
 * Where:
 *   F  = H * (1 - ρ_i/ρ_w)           freeboard (m)
 *   w  = ρ_i / ρ_w                    relative water depth (~0.892)
 *   F_t = 75 - 49*w                   critical freeboard threshold (m)
 *   F_s = 115*w^(-0.356) + 21         scaling factor (m)
 *   s  = 0.17*(9.1*w + 1.76)          exponent (~2–3)
 */

import { RHO_ICE, RHO_WATER, MICI_C0, MICI_C_MAX, MICI_F_MARGIN } from './constants';
import type { ModelState } from './types';

/** Density ratio ρ_ice / ρ_water (constant for all calls). */
const W_RATIO = RHO_ICE / RHO_WATER;

/**
 * Critical freeboard threshold (m). The geometric Schlemm–Levermann form is
 * 75 − 49·W_RATIO ≈ 31 m; a Bassis-consistent viscoelastic margin is added
 * so cliffs below ~90 m of freeboard remain quasi-stable.
 */
const F_THRESHOLD = 75 - 49 * W_RATIO + MICI_F_MARGIN;

/** Scaling factor (m). */
const F_SCALE = 115 * Math.pow(W_RATIO, -0.356) + 21;

/** Exponent for the calving rate power law. */
const S_EXP = 0.17 * (9.1 * W_RATIO + 1.76);

/**
 * Compute freeboard (height above waterline) for grounded ice at the
 * marine terminus.
 *
 * For grounded ice in contact with the ocean:
 *   freeboard = H * (1 - ρ_i / ρ_w)
 */
export function computeFreeboard(H: number): number {
  return H * (1 - W_RATIO);
}

/**
 * Compute the MICI calving rate for a cliff of thickness H.
 *
 * @param H         Ice thickness at the calving front (m)
 * @param sensitivity  User-controlled scaling on C_0 (default 1.0)
 * @returns Calving rate (m/yr), 0 if below threshold, capped at MICI_C_MAX
 */
export function computeMICICalvingRate(H: number, sensitivity: number = 1.0): number {
  const F = computeFreeboard(H);
  if (F <= F_THRESHOLD) return 0;

  const rate = sensitivity * MICI_C0 * Math.pow((F - F_THRESHOLD) / F_SCALE, S_EXP);
  return Math.min(rate, MICI_C_MAX);
}

/**
 * Minimum floating-shelf thickness that counts as "buttressing". If all
 * floating ice downstream of the GL is thinner than this, the shelf is
 * considered gone and MICI can activate.
 */
const MIN_BUTTRESSING_THICKNESS = 50; // m

/**
 * Apply cliff calving (MICI) to the ice sheet.
 *
 * Steps:
 * 1. Determine if a substantial ice shelf still exists (provides buttressing).
 * 2. If no shelf, compute freeboard at the calving front.
 * 3. If freeboard exceeds the critical threshold, compute calving rate and
 *    remove ice by converting the horizontal retreat to grid-cell thickness
 *    reduction.
 *
 * @returns New H array (immutable) plus diagnostic values.
 */
export function applyCliffCalving(
  state: ModelState,
  dt: number,
): {
  H: Float64Array;
  cliff_height: number;
  mici_calving_rate: number;
  is_mici_active: boolean;
} {
  const { H, is_floating, gl_index, grid, params } = state;
  const { nx, dx } = grid;
  const sensitivity = params.mici_sensitivity ?? 1.0;

  // ── 1. Check if a buttressing shelf still exists ──────────────
  let shelfExists = false;
  for (let i = gl_index + 1; i < nx; i++) {
    if (is_floating[i] && H[i] >= MIN_BUTTRESSING_THICKNESS) {
      shelfExists = true;
      break;
    }
  }

  if (shelfExists) {
    return { H: new Float64Array(H), cliff_height: 0, mici_calving_rate: 0, is_mici_active: false };
  }

  // ── 2. Find the calving front (first substantial ice from ocean end) ──
  let frontIndex = -1;
  for (let i = nx - 1; i >= 0; i--) {
    if (H[i] >= MIN_BUTTRESSING_THICKNESS) {
      frontIndex = i;
      break;
    }
  }

  if (frontIndex < 0) {
    // No substantial ice at all
    return { H: new Float64Array(H), cliff_height: 0, mici_calving_rate: 0, is_mici_active: false };
  }

  // ── 3. Compute freeboard and calving rate ─────────────────────
  const cliff_height = computeFreeboard(H[frontIndex]);
  const mici_calving_rate = computeMICICalvingRate(H[frontIndex], sensitivity);

  if (mici_calving_rate <= 0) {
    return { H: new Float64Array(H), cliff_height, mici_calving_rate: 0, is_mici_active: false };
  }

  // ── 4. Convert horizontal retreat to thickness removal ────────
  // Retreat distance this timestep (m)
  const retreatDistance = mici_calving_rate * dt;
  const H_new = new Float64Array(H);

  // Remove ice from the front, cell by cell
  let remaining = retreatDistance;
  for (let i = frontIndex; i >= 0 && remaining > 0; i--) {
    if (H_new[i] < MIN_BUTTRESSING_THICKNESS) continue;

    if (remaining >= dx) {
      // Remove entire cell
      H_new[i] = 0;
      remaining -= dx;
    } else {
      // Partial cell: reduce thickness proportionally
      const fraction = remaining / dx;
      H_new[i] *= (1 - fraction);
      if (H_new[i] < 10) H_new[i] = 0;
      remaining = 0;
    }
  }

  return { H: H_new, cliff_height, mici_calving_rate, is_mici_active: true };
}
