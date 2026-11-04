/**
 * Frame timing for the 2D canvas: the clamped per-frame delta, 60 Hz-relative
 * steps for the particle systems, and the paused-loop throttle.
 *
 * Particle tunings were authored as "per frame at 60 Hz"; scaling them by
 * `frameSteps(dt)` keeps their speed independent of the display refresh rate.
 */

/** Frame duration the particle tunings were authored against (60 Hz). */
export const REFERENCE_FRAME_S = 1 / 60;

/** Longest frame simulated at once, so a stall or background tab cannot teleport particles. */
export const MAX_FRAME_DELTA_S = 0.05;

/** Target interval while the simulation is paused (~30 fps). */
export const PAUSED_FRAME_INTERVAL_MS = 1000 / 30;

/** Slack so a 60 Hz display reliably draws every second frame when throttled. */
const THROTTLE_SLACK_MS = 4;

/** Convert a rAF timestamp delta (ms) to seconds, clamped to [0, MAX_FRAME_DELTA_S]. */
export function clampFrameDelta(deltaMs: number): number {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
  return Math.min(deltaMs / 1000, MAX_FRAME_DELTA_S);
}

/** How many 60 Hz reference frames `dtSeconds` covers (1 at 60 Hz, 0.5 at 120 Hz). */
export function frameSteps(dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return 0;
  return dtSeconds / REFERENCE_FRAME_S;
}

/**
 * Snap a step count to the nearest whole number when it is within
 * `tolerance`, so fixed-step systems run exactly one step per frame at 60 Hz
 * (two at 30 Hz) instead of jittering between 0 and 2 on timestamp noise.
 */
export function snapSteps(steps: number, tolerance = 0.1): number {
  const nearest = Math.round(steps);
  return nearest > 0 && Math.abs(steps - nearest) <= tolerance ? nearest : steps;
}

/**
 * Frame delta (seconds) handed to the particle systems: clamped, then snapped
 * to whole 60 Hz frames when close, so 60 Hz (and throttled 30 Hz) playback
 * matches the original per-frame tuning exactly.
 */
export function normalizeFrameDelta(deltaMs: number): number {
  return snapSteps(frameSteps(clampFrameDelta(deltaMs))) * REFERENCE_FRAME_S;
}

/** Whether a frame at `now` should be drawn given the last drawn frame and a minimum interval. */
export function shouldRenderFrame(now: number, lastRendered: number | null, minIntervalMs: number): boolean {
  if (lastRendered === null || minIntervalMs <= 0) return true;
  return now - lastRendered >= minIntervalMs - THROTTLE_SLACK_MS;
}

/**
 * Accumulates fractional spawn counts across frames, so "N spawns per 60 Hz
 * frame" stays N per 1/60 s at any refresh rate.
 */
export interface SpawnBudget {
  /** Add `perFrame × steps` and return how many whole spawns are now due. */
  take: (perFrame: number, steps: number) => number;
  /** Drop any accumulated remainder (e.g. when the population is capped). */
  clear: () => void;
}

export function createSpawnBudget(): SpawnBudget {
  let pending = 0;
  return {
    take: (perFrame, steps) => {
      // Snapping keeps exactly `perFrame` spawns per frame at 60 Hz despite timestamp jitter.
      pending += Math.max(0, perFrame) * Math.max(0, snapSteps(steps));
      const due = Math.floor(pending);
      pending -= due;
      return due;
    },
    clear: () => {
      pending = 0;
    },
  };
}
