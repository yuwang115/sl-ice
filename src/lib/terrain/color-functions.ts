/**
 * Color mapping functions for terrain rendering.
 * Ported from 3D-ICE explorer to produce identical visual output.
 */

import {
  BED_ELEVATION_MIN,
  BED_ELEVATION_MAX,
  GMT_RELIEF_OCEAN_ZERO,
  GMT_RELIEF_LAND_ZERO,
  ICE_THICKNESS_REFERENCE,
  VELOCITY_MAX,
  VELOCITY_KNEE,
  VELOCITY_COLOR_STOPS,
  MASK_FLOATING,
} from './constants';

// ── Utilities ────────────────────────────────────────────────────────

export type RGB = [number, number, number];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(from: readonly number[], to: readonly number[], t: number): RGB {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

// ── LUT sampling ─────────────────────────────────────────────────────

export function sampleColorLUT(lut: readonly RGB[], t: number): RGB {
  if (!lut.length) return [0, 0, 0];
  const scaled = clamp01(t) * (lut.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(lut.length - 1, i0 + 1);
  return lerpColor(lut[i0], lut[i1], scaled - i0);
}

export function sampleColorStops(
  stops: readonly (readonly [number, readonly [number, number, number]])[],
  t: number,
): RGB {
  if (!stops.length) return [1, 1, 1];
  const clamped = clamp01(t);
  if (clamped <= stops[0][0]) return [...stops[0][1]];
  for (let i = 1; i < stops.length; i++) {
    if (clamped <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const localT = (clamped - t0) / Math.max(1e-6, t1 - t0);
      return lerpColor(c0, c1, localT);
    }
  }
  return [...stops[stops.length - 1][1]];
}

// ── Bed color (GMT Relief) ───────────────────────────────────────────

export function bedColor(
  heightMeters: number,
  oceanLut: readonly RGB[],
  landLut: readonly RGB[],
): RGB {
  const clamped = Math.max(BED_ELEVATION_MIN, Math.min(BED_ELEVATION_MAX, heightMeters));

  if (clamped < 0) {
    const t = clamp01((clamped - BED_ELEVATION_MIN) / (0 - BED_ELEVATION_MIN));
    const lut = oceanLut.length ? oceanLut : [GMT_RELIEF_OCEAN_ZERO as RGB];
    return sampleColorLUT(lut, t);
  }

  if (clamped > 0) {
    const t = clamp01(clamped / BED_ELEVATION_MAX);
    const lut = landLut.length ? landLut : [GMT_RELIEF_LAND_ZERO as RGB];
    return sampleColorLUT(lut, t);
  }

  // Exactly 0m — blend ocean/land boundary
  const oceanZero = oceanLut.length
    ? oceanLut[oceanLut.length - 1]
    : (GMT_RELIEF_OCEAN_ZERO as RGB);
  const landZero = landLut.length ? landLut[0] : (GMT_RELIEF_LAND_ZERO as RGB);
  return lerpColor(oceanZero, landZero, 0.5);
}

// ── Ice color ────────────────────────────────────────────────────────

export function iceColor(thicknessMeters: number, maskValue: number): RGB {
  const t = clamp01(thicknessMeters / ICE_THICKNESS_REFERENCE);
  const grounded = lerpColor([0.72, 0.84, 0.95], [0.97, 0.99, 1.0], t);
  const floating = lerpColor([0.58, 0.78, 0.93], [0.87, 0.95, 1.0], t);
  return maskValue === MASK_FLOATING ? floating : grounded;
}

/** Returns true for mask values that represent ice-covered cells. */
export function isIceCovered(maskValue: number): boolean {
  return maskValue === 2 || maskValue === 3 || maskValue === 4;
}

// ── Velocity color ───────────────────────────────────────────────────

export function velocityScaleT(speedMetersPerYear: number): number {
  const clamped = Math.max(0, Math.min(VELOCITY_MAX, speedMetersPerYear));
  const safeKnee = Math.max(1e-6, VELOCITY_KNEE);
  return clamp01(Math.log1p(clamped / safeKnee) / Math.log1p(VELOCITY_MAX / safeKnee));
}

export function velocityColor(speedMetersPerYear: number): RGB {
  return sampleColorStops(VELOCITY_COLOR_STOPS, velocityScaleT(speedMetersPerYear));
}
