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

import { RHO_ICE, RHO_WATER, G } from './constants';
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
 * For the grid cell containing the GL, friction is scaled by the
 * grounded fraction λ.
 *
 * @param i Grid index
 * @param gl_index Grounding line node index
 * @param gl_position Interpolated GL position (m)
 * @param dx Grid spacing (m)
 * @returns Friction factor (0 = floating, 1 = fully grounded)
 */
export function subElementFriction(
  i: number,
  gl_index: number,
  gl_position: number,
  dx: number,
): number {
  if (i < gl_index) return 1.0;      // Fully grounded
  if (i > gl_index + 1) return 0.0;  // Fully floating

  if (i === gl_index) {
    // Cell just upstream of GL: mostly grounded
    return 1.0;
  }

  // i === gl_index + 1: partially grounded cell
  const cellStart = gl_index * dx;
  const lambda = (gl_position - cellStart) / dx;
  return Math.max(0, Math.min(1, lambda));
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
 * Grounding line flux parameterization.
 *
 * Modifies the depth-averaged velocity near the GL to ensure proper
 * flux divergence for GL migration. Two physical mechanisms:
 *
 * 1. Driving stress velocity: τ_d = ρ_i*g*H*|ds/dx| → u ∝ τ_d^n * H
 * 2. Buttressing: reduced ice shelf → less back-stress → faster GL flow
 *
 * Following the reference marine-ice-sheet-flowline approach with a
 * float-boost factor for floating ice acceleration.
 */
export function applySchoofFlux(
  u_avg: Float64Array,
  H: Float64Array,
  b: Float64Array,
  s: Float64Array,
  is_floating: Uint8Array,
  gl_index: number,
  grid: ModelGrid,
): void {
  const { nx, dx } = grid;

  if (gl_index < 1 || gl_index >= nx - 1) return;

  const H_gl = H[gl_index];
  if (H_gl < 50) return;

  // ── 1. Driving stress at GL ──
  const dsdx = Math.abs((s[gl_index] - s[gl_index - 1]) / dx);
  const tauD = RHO_ICE * G * H_gl * dsdx; // Pa

  // ── 2. Driving-stress velocity (SSA-like, tuned for real-time) ──
  // Deformation: u_d ∝ A * τ^n * H
  // Using calibrated coefficient matching reference model
  const tauNorm = tauD / 1e5; // Normalize to ~100 kPa
  const u_deform = 8.0 * Math.pow(tauNorm, 3) * H_gl; // m/yr

  // Sliding: u_s ∝ τ² (power-law sliding)
  const u_slide = 100.0 * Math.pow(tauNorm, 2); // m/yr

  let u_gl = u_deform + u_slide;

  // ── 3. Buttressing ──
  // Measure remaining shelf thickness relative to a "full" shelf
  let shelfVolume = 0;
  let shelfCount = 0;
  for (let i = gl_index + 1; i < nx; i++) {
    if (is_floating[i] && H[i] > 10) {
      shelfVolume += H[i];
      shelfCount++;
    }
  }
  // buttressing: 1.0 = full shelf, 0.0 = no shelf
  const refThickness = 300; // m, reference shelf thickness for full buttressing
  const buttressing = shelfCount > 0
    ? Math.min(1.0, shelfVolume / (shelfCount * refThickness))
    : 0;
  // Less buttressing → up to 3× velocity increase
  const buttressingBoost = 1.0 + 2.0 * Math.pow(1 - buttressing, 1.5);
  u_gl *= buttressingBoost;

  // ── 4. Water depth factor ──
  const waterDepth = Math.max(0, -b[gl_index]);
  const depthBoost = 1.0 + 0.5 * Math.min(waterDepth / 600, 2.0);
  u_gl *= depthBoost;

  // ── 5. Apply minimum GL velocity ──
  // Ensure a minimum outflow at the GL (even with full buttressing)
  u_gl = Math.max(u_gl, 100); // At least 100 m/yr
  u_gl = Math.min(u_gl, 5000); // Cap for stability

  if (u_avg[gl_index] < u_gl) {
    u_avg[gl_index] = u_gl;
  }

  // ── 6. Smooth velocity transition ──
  // Upstream of GL: gradual ramp
  for (let di = 1; di <= 3; di++) {
    const iUp = gl_index - di;
    if (iUp < 1 || is_floating[iUp]) continue;
    const w = 1 - di / 4;
    const target = u_avg[gl_index] * w + u_avg[iUp] * (1 - w);
    if (u_avg[iUp] < target) {
      u_avg[iUp] = target;
    }
  }

  // Downstream of GL: floating ice accelerates (float boost)
  for (let di = 1; di <= 5; di++) {
    const iDown = gl_index + di;
    if (iDown >= nx || !is_floating[iDown] || H[iDown] < 10) break;
    const boost = 1.0 + 0.45 * (1 - di / 6); // Up to 45% faster
    const target = u_avg[gl_index] * boost;
    if (u_avg[iDown] < target) {
      u_avg[iDown] = target;
    }
  }
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
