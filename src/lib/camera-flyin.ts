/**
 * Pure helpers for the explorer's camera fly-in toward a flowline.
 */

export type Vec3Tuple = readonly [number, number, number];

/** Duration of the camera move (seconds). */
export const FLY_IN_DURATION_S = 1.4;
/** Final camera distance from the target point (world units). */
export const FLY_IN_END_DISTANCE = 8;
/**
 * Largest frame delta fed into the animation. A long frame (shader compile,
 * GC, background tab) then slows the move down instead of turning it into a cut.
 */
export const FLY_IN_MAX_FRAME_DELTA_S = 0.05;
/** Peak intensity of the glow light at the target. */
export const FLY_IN_GLOW_MAX = 6;

/** Deceleration ease — fast start, gentle stop. */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Clamp a frame delta (seconds) to [0, max]; non-finite input counts as 0. */
export function clampFrameDelta(delta: number, max: number = FLY_IN_MAX_FRAME_DELTA_S): number {
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, max);
}

/**
 * Camera end position: FLY_IN_END_DISTANCE from the target, along the current
 * viewing direction (target → camera). Falls back to straight above the
 * target when the camera already sits on it.
 */
export function computeFlyInEndPosition(
  camera: Vec3Tuple,
  target: Vec3Tuple,
  distance: number = FLY_IN_END_DISTANCE,
): [number, number, number] {
  const dx = camera[0] - target[0];
  const dy = camera[1] - target[1];
  const dz = camera[2] - target[2];
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-9) return [target[0], target[1] + distance, target[2]];
  const scale = distance / length;
  return [target[0] + dx * scale, target[1] + dy * scale, target[2] + dz * scale];
}

export interface FlyInFrame {
  /** Eased interpolation factor for the camera position. */
  readonly positionT: number;
  /** Eased factor for the look-at point (converges faster for a cinematic pull). */
  readonly lookAtT: number;
  /** Glow light intensity at the target. */
  readonly glow: number;
}

/** Animation state after `elapsed` seconds of (clamped) frame time. */
export function flyInFrame(elapsed: number, duration: number = FLY_IN_DURATION_S): FlyInFrame {
  const rawT = Math.max(0, Math.min(1, elapsed / duration));
  return {
    positionT: easeOutQuart(rawT),
    lookAtT: easeOutQuart(Math.min(1, rawT * 1.3)),
    glow: Math.min(FLY_IN_GLOW_MAX, rawT * 8),
  };
}
