/**
 * Ice thickness evolution equation (mass conservation).
 *
 * ∂H/∂t = ȧ - ḃ - ∂(ūH)/∂x
 *
 * Semi-implicit time stepping with upwind flux scheme:
 *   H^{n+1} = H^n + Δt * [ȧ - ḃ - ∂F/∂x]
 *
 * where F = ū^{n+1} * H^n (upwind)
 */

import { H_MIN, H_MAX } from './constants';
import type { ModelGrid } from './types';

/**
 * Advance ice thickness by one time step using semi-implicit upwind scheme.
 *
 * @param H Current ice thickness (m)
 * @param u_avg Depth-averaged velocity at new time step (m/yr)
 * @param smb Surface mass balance (m/yr, positive = accumulation)
 * @param basal_melt Basal melt rate (m/yr, positive = melting)
 * @param grid Model grid
 * @param dt Time step (years)
 * @returns New ice thickness (m)
 */
/**
 * Upwind volume flux (m²/yr) through the face between cells i and i+1.
 * Next to an ice-free cell the face takes the ice cell's own velocity:
 * the ice-free cell's u = 0 is a placeholder, and averaging with it would
 * halve the outflow through a retreated calving front.
 */
function faceFlux(H: Float64Array, u_avg: Float64Array, i: number): number {
  const iceLeft = H[i] >= H_MIN;
  const iceRight = H[i + 1] >= H_MIN;
  let uFace: number;
  if (iceLeft === iceRight) uFace = 0.5 * (u_avg[i] + u_avg[i + 1]);
  else uFace = iceLeft ? u_avg[i] : u_avg[i + 1];
  return uFace * (uFace >= 0 ? H[i] : H[i + 1]);
}

export function evolveThickness(
  H: Float64Array,
  u_avg: Float64Array,
  smb: Float64Array,
  basal_melt: Float64Array,
  grid: ModelGrid,
  dt: number,
): Float64Array {
  const { nx, dx } = grid;
  const H_new = new Float64Array(nx);

  // flux[i] = flux through face i+½; the last face is the calving flux
  // ū·H out of the domain end. No flux enters at the ice divide (i = 0).
  const flux = new Float64Array(nx);
  for (let i = 0; i < nx - 1; i++) flux[i] = faceFlux(H, u_avg, i);
  flux[nx - 1] = u_avg[nx - 1] * H[nx - 1];

  for (let i = 0; i < nx; i++) {
    const dFdx = (flux[i] - (i > 0 ? flux[i - 1] : 0)) / dx;

    // Time step
    H_new[i] = H[i] + dt * (smb[i] - basal_melt[i] - dFdx);

    // Floor and ceiling: prevent blow-up
    if (H_new[i] < H_MIN) {
      H_new[i] = 0;
    } else if (H_new[i] > H_MAX) {
      H_new[i] = H_MAX;
    }
  }

  return H_new;
}

/**
 * Remove floating ice that an ice-free gap has cut off from the anchored
 * ice body (grounded ice, or the divide at i = 0). Such icebergs would
 * drift away; left in place they make the momentum system singular.
 */
function removeDetachedIce(H: Float64Array, is_floating: Uint8Array): boolean {
  const nx = H.length;
  let lastAnchor = -1;
  for (let i = 0; i < nx; i++) {
    if (H[i] >= H_MIN && (i === 0 || !is_floating[i])) lastAnchor = i;
  }
  if (lastAnchor < 0) return false;

  let removed = false;
  let gap = false;
  for (let i = lastAnchor + 1; i < nx; i++) {
    if (H[i] < H_MIN) {
      gap = true;
    } else if (gap) {
      H[i] = 0;
      removed = true;
    }
  }
  return removed;
}

/**
 * Apply calving: remove ice thinner than a threshold at the calving front,
 * and floating ice detached from the main ice body.
 *
 * `calved` is true only when ice was actually removed this call, so
 * already-open water at the ocean end does not register as calving.
 */
export function applyCalving(
  H: Float64Array,
  is_floating: Uint8Array,
  minShelfThickness: number = 50, // m
): { H: Float64Array; calved: boolean } {
  const nx = H.length;
  const H_out = new Float64Array(H);
  let calved = removeDetachedIce(H_out, is_floating);

  // From the ocean end, remove thin floating ice
  for (let i = nx - 1; i >= 0; i--) {
    if (H_out[i] >= minShelfThickness) break; // Stop at substantial ice
    if (is_floating[i] && H_out[i] > 0) {
      H_out[i] = 0;
      calved = true;
    }
  }

  return { H: H_out, calved };
}
