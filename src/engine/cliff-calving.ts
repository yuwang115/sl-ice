/**
 * Marine Ice Cliff Instability (MICI) calving parameterization.
 *
 * Schlemm & Levermann (2019), "A simple stress-based cliff-calving law",
 * The Cryosphere 13:2475–2488, Eqs. 23–27:
 *
 *   C   = C_0 · ((F − F_c) / F_s)^s      for F > F_c, else 0
 *   F_s = 115 · (w − 0.356)^4 + 21   (m)
 *   F_c = 75 − 49 · w                (m)
 *   s   = 0.17 · 9.1^w + 1.76
 *   C_0 = 1 m / 4 d = 91.25 m/yr
 *
 * with w = D/H < 0.9 the relative water depth and F = H − D the freeboard of
 * the ice at the calving front (D = water depth there). The exponent runs
 * from ~1.9 for a dry cliff to 3 near flotation. F_c here also carries
 * MICI_F_MARGIN (Bassis & Walker 2012), so cliffs below ~90 m stay stable.
 *
 * The law acts wherever the calving front is a tall cliff. A shelf front is
 * thin, so an intact shelf suppresses cliff failure by itself; once the
 * shelf is gone the front is the thick ice at the grounding line, and on a
 * retrograde bed every collapse exposes a taller cliff.
 */

import { RHO_ICE, RHO_WATER, MICI_C0, MICI_C_MAX, MICI_F_MARGIN } from './constants';
import type { ModelState } from './types';

/** Upper end of the relative water depths the law was derived for. */
const W_MAX = 0.9;

/** Thinnest ice (m) that counts as the calving front. */
const FRONT_MIN_THICKNESS = 50;

export interface CliffCalvingParameters {
  /** Critical freeboard F_c (m), without MICI_F_MARGIN. */
  readonly criticalFreeboard: number;
  /** Scaling freeboard F_s (m). */
  readonly scaleFreeboard: number;
  /** Exponent s. */
  readonly exponent: number;
}

/** Schlemm & Levermann (2019) Eqs. 24–26 for relative water depth `w`. */
export function cliffCalvingParameters(w: number): CliffCalvingParameters {
  const depth = Math.min(Math.max(w, 0), W_MAX);
  return {
    criticalFreeboard: 75 - 49 * depth,
    scaleFreeboard: 115 * Math.pow(depth - 0.356, 4) + 21,
    exponent: 0.17 * Math.pow(9.1, depth) + 1.76,
  };
}

/**
 * Cliff-calving rate (m/yr) of a front with `freeboard` F = H − D and
 * relative water depth w = D/H; 0 below the (margin-raised) critical
 * freeboard, capped at MICI_C_MAX.
 */
export function computeMICICalvingRate(
  freeboard: number,
  relativeDepth: number,
  sensitivity: number = 1.0,
): number {
  const { criticalFreeboard, scaleFreeboard, exponent } = cliffCalvingParameters(relativeDepth);
  const excess = freeboard - (criticalFreeboard + MICI_F_MARGIN);
  if (!(excess > 0) || !(sensitivity > 0)) return 0;
  const rate = sensitivity * MICI_C0 * Math.pow(excess / scaleFreeboard, exponent);
  return Math.min(rate, MICI_C_MAX);
}

export interface CalvingFront {
  readonly index: number;
  /** Ice above the waterline at the front, F = H − D (m). */
  readonly freeboard: number;
  /** Relative water depth w = D/H. */
  readonly relativeDepth: number;
}

/**
 * The seaward-most ice at least FRONT_MIN_THICKNESS thick, if it ends in the
 * ocean. Floating ice sits at its draft; grounded ice in the local water depth.
 */
export function findCalvingFront(
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
): CalvingFront | null {
  let index = -1;
  for (let i = H.length - 1; i >= 0; i--) {
    if (H[i] >= FRONT_MIN_THICKNESS) {
      index = i;
      break;
    }
  }
  if (index < 0) return null;

  const thickness = H[index];
  const waterDepth = is_floating[index]
    ? thickness * (RHO_ICE / RHO_WATER)
    : Math.max(0, -b[index]);
  if (!(waterDepth > 0)) return null; // land-terminating: no marine cliff
  return {
    index,
    freeboard: thickness - waterDepth,
    relativeDepth: waterDepth / thickness,
  };
}

export interface CliffCalvingResult {
  readonly H: Float64Array;
  readonly cliff_height: number;
  readonly mici_calving_rate: number;
  readonly is_mici_active: boolean;
  /** Calved distance (m) not yet a whole grid cell; carried to the next step. */
  readonly pending_retreat: number;
}

/**
 * Apply cliff calving (MICI) for one step of `dt` years.
 *
 * The front retreats at the calving rate. Distance is accumulated and whole
 * cells are removed, so the cliff keeps its full height until it fails
 * instead of being thinned below the failure threshold.
 */
export function applyCliffCalving(state: ModelState, dt: number): CliffCalvingResult {
  const { H, b, is_floating, grid, params } = state;
  const sensitivity = params.mici_sensitivity ?? 1.0;
  const front = findCalvingFront(H, b, is_floating);
  if (!front) {
    return { H: new Float64Array(H), cliff_height: 0, mici_calving_rate: 0, is_mici_active: false, pending_retreat: 0 };
  }

  const rate = computeMICICalvingRate(front.freeboard, front.relativeDepth, sensitivity);
  if (rate <= 0) {
    return {
      H: new Float64Array(H), cliff_height: front.freeboard,
      mici_calving_rate: 0, is_mici_active: false, pending_retreat: 0,
    };
  }

  const H_new = new Float64Array(H);
  let remaining = (state.mici_pending_retreat ?? 0) + rate * dt;
  for (let i = front.index; i >= 0 && remaining >= grid.dx; i--) {
    H_new[i] = 0;
    remaining -= grid.dx;
  }
  return {
    H: H_new, cliff_height: front.freeboard,
    mici_calving_rate: rate, is_mici_active: true, pending_retreat: remaining,
  };
}
