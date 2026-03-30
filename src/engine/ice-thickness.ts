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

  for (let i = 0; i < nx; i++) {
    // Compute flux divergence ∂(ūH)/∂x using upwind scheme
    let dFdx = 0;

    if (i === 0) {
      // Ice divide: symmetry BC, ∂H/∂x = 0, u = 0
      // Only outward flux at i+1/2
      const u_half = 0.5 * (u_avg[0] + u_avg[1]);
      const H_flux = u_half >= 0 ? H[0] : H[1];
      dFdx = (u_half * H_flux) / dx;
    } else if (i === nx - 1) {
      // Calving front: only inward flux at i-1/2
      const u_half_left = 0.5 * (u_avg[i - 1] + u_avg[i]);
      const H_flux_left = u_half_left >= 0 ? H[i - 1] : H[i];

      // Outward flux at calving front = ū * H (calving flux)
      const F_out = u_avg[i] * H[i];
      const F_in = u_half_left * H_flux_left;
      dFdx = (F_out - F_in) / dx;
    } else {
      // Interior: upwind flux at i+1/2 and i-1/2
      const u_right = 0.5 * (u_avg[i] + u_avg[i + 1]);
      const u_left = 0.5 * (u_avg[i - 1] + u_avg[i]);

      const H_right = u_right >= 0 ? H[i] : H[i + 1];
      const H_left = u_left >= 0 ? H[i - 1] : H[i];

      dFdx = (u_right * H_right - u_left * H_left) / dx;
    }

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
 * Apply calving: remove ice thinner than a threshold at the calving front.
 * Also ensure no isolated floating ice patches.
 */
export function applyCalving(
  H: Float64Array,
  is_floating: Uint8Array,
  minShelfThickness: number = 50, // m
): { H: Float64Array; calved: boolean } {
  const nx = H.length;
  const H_out = new Float64Array(H);
  let calved = false;

  // From the ocean end, remove thin floating ice
  for (let i = nx - 1; i >= 0; i--) {
    if (is_floating[i] && H_out[i] < minShelfThickness) {
      H_out[i] = 0;
      calved = true;
    } else if (H_out[i] >= minShelfThickness) {
      break; // Stop once we hit substantial ice
    }
  }

  return { H: H_out, calved };
}
