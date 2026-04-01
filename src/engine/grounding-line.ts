/**
 * Grounding line tracking.
 *
 * The grounding line position x_gl is determined by the flotation condition:
 *   ρ_i * H(x_gl) = -ρ_w * b(x_gl)
 *
 * Implementation:
 * 1. Check flotation at each node: f(x) = ρ_i * H(x) + ρ_w * b(x)
 *    f > 0 → grounded, f ≤ 0 → floating
 * 2. GL is between last grounded and first floating node
 * 3. Linear interpolation for precise position
 * 4. Sub-element friction parameterization near the GL
 */

import { RHO_ICE, RHO_WATER } from './constants';
import type { ModelGrid } from './types';

/**
 * Flotation function: f(x) = ρ_i * H(x) + ρ_w * b(x)
 * f > 0 → grounded, f ≤ 0 → floating (or no ice)
 */
export function flotationFunction(H: number, b: number): number {
  return RHO_ICE * H + RHO_WATER * b;
}

/**
 * Determine if ice at a point is floating.
 */
export function isFloating(H: number, b: number): boolean {
  if (H < 1) return false; // No ice
  // Floating if ice is thin enough relative to water depth
  return flotationFunction(H, b) <= 0;
}

/**
 * Update grounding line position and floating mask.
 *
 * @returns Object with GL index, interpolated position, and floating mask
 */
export function updateGroundingLine(
  H: Float64Array,
  b: Float64Array,
  grid: ModelGrid,
): {
  gl_index: number;
  gl_position: number;
  is_floating: Uint8Array;
} {
  const { nx, dx } = grid;
  const is_floating = new Uint8Array(nx);

  // Compute flotation at each node
  let gl_index = nx - 1; // Default: all grounded
  let foundGL = false;

  for (let i = 0; i < nx; i++) {
    if (H[i] < 1) {
      // No ice: treat as floating (ocean)
      is_floating[i] = 1;
      if (!foundGL) {
        gl_index = Math.max(0, i - 1);
        foundGL = true;
      }
    } else if (isFloating(H[i], b[i])) {
      is_floating[i] = 1;
      if (!foundGL) {
        gl_index = Math.max(0, i - 1);
        foundGL = true;
      }
    } else {
      is_floating[i] = 0;
    }
  }

  // Interpolate GL position between gl_index and gl_index+1
  let gl_position = gl_index * dx;

  if (gl_index < nx - 1 && gl_index >= 0) {
    const f_i = flotationFunction(H[gl_index], b[gl_index]);
    const f_ip1 = flotationFunction(H[gl_index + 1], b[gl_index + 1]);

    if (Math.abs(f_ip1 - f_i) > 1e-10) {
      // Linear interpolation: find where f = 0
      const lambda = -f_i / (f_ip1 - f_i);
      gl_position = (gl_index + Math.max(0, Math.min(1, lambda))) * dx;
    }
  }

  return { gl_index, gl_position, is_floating };
}

/**
 * Compute sub-element grounding line friction factor.
 *
 * For any grounded node adjacent to a floating node (i.e. at a
 * grounding-line transition), friction is scaled by the grounded
 * fraction λ of the partially grounded grid cell.  This handles
 * multiple grounding lines — including re-grounding on topographic
 * highs (pinning points) — by checking the local flotation
 * transition rather than relying on a single gl_index.
 *
 * @param i Grid index
 * @param H Ice thickness array
 * @param b Bed elevation array
 * @param dx Grid spacing (m)
 * @param is_floating Floating mask
 * @returns Friction factor (0 = floating, 1 = fully grounded,
 *          0–1 at grounding-line transitions)
 */
export function subElementFriction(
  i: number,
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
): number {
  // Floating → no friction
  if (is_floating[i]) return 0.0;

  // Fully grounded with no adjacent floating node → full friction
  const nx = is_floating.length;
  const hasFloatingNeighbor =
    (i < nx - 1 && is_floating[i + 1]) ||
    (i > 0 && is_floating[i - 1]);

  if (!hasFloatingNeighbor) return 1.0;

  // At a grounding-to-floating transition: interpolate the grounded
  // fraction using the flotation function on the downstream side.
  if (i < nx - 1 && is_floating[i + 1]) {
    const f_i = flotationFunction(H[i], b[i]);
    const f_ip1 = flotationFunction(H[i + 1], b[i + 1]);
    if (Math.abs(f_ip1 - f_i) > 1e-10) {
      const lambda = -f_i / (f_ip1 - f_i);
      return Math.max(0, Math.min(1, lambda));
    }
  }

  return 1.0;
}

/**
 * Compute surface elevation from ice thickness and bedrock,
 * accounting for flotation.
 *
 * Grounded: s = b + H
 * Floating: s = H * (1 - ρ_i/ρ_w)  (freeboard)
 */
export function computeSurfaceElevation(
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
): Float64Array {
  const nx = H.length;
  const s = new Float64Array(nx);

  for (let i = 0; i < nx; i++) {
    if (H[i] < 1) {
      s[i] = Math.max(0, b[i]); // No ice
    } else if (is_floating[i]) {
      // Floating: freeboard = H * (1 - ρ_i/ρ_w)
      s[i] = H[i] * (1 - RHO_ICE / RHO_WATER);
    } else {
      // Grounded: surface = bedrock + thickness
      s[i] = b[i] + H[i];
    }
  }

  return s;
}

/**
 * Compute ice base elevation (bottom of ice).
 *
 * Grounded: ice_base = b (resting on bedrock)
 * Floating: ice_base = -H * ρ_i/ρ_w (hydrostatic draft below sea level)
 *
 * This gives a continuous ice body when combined with surface elevation.
 */
export function computeIceBase(
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
): Float64Array {
  const nx = H.length;
  const ice_base = new Float64Array(nx);

  for (let i = 0; i < nx; i++) {
    if (H[i] < 1) {
      ice_base[i] = b[i]; // No ice
    } else if (is_floating[i]) {
      // Floating: draft below sea level
      ice_base[i] = -(H[i] * RHO_ICE / RHO_WATER);
    } else {
      // Grounded: resting on bedrock
      ice_base[i] = b[i];
    }
  }

  return ice_base;
}

/**
 * Compute ice volume in km³ and sea level equivalent.
 *
 * Only grounded ice above flotation contributes to sea level.
 */
export function computeIceVolume(
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
  dx: number,
  flowlineWidth: number = 1000, // 1 km width for flowline
): { volume: number; volumeAboveFlotation: number } {
  let volume = 0;
  let volumeAboveFlotation = 0;

  for (let i = 0; i < H.length; i++) {
    if (H[i] < 1) continue;
    volume += H[i] * dx * flowlineWidth;

    if (!is_floating[i]) {
      // Height above flotation
      const Hf = Math.max(0, -b[i] * RHO_WATER / RHO_ICE);
      const Haf = Math.max(0, H[i] - Hf);
      volumeAboveFlotation += Haf * dx * flowlineWidth;
    }
  }

  // Convert m³ to km³
  volume *= 1e-9;
  volumeAboveFlotation *= 1e-9;

  return { volume, volumeAboveFlotation };
}
