/**
 * Challenge scoring engine.
 *
 * Computes a 0-100 score based on four dimensions:
 * - Stability (40%): How well the ice sheet was maintained
 * - Efficiency (30%): Fewer parameter changes = more thoughtful play
 * - Speed (20%): Earlier stabilization = better understanding
 * - Elegance (10%): Challenge-specific bonus criteria
 */

import type { PhysicsStatePayload, ChallengeDefinition } from './types';

/** Clamp a value to [0, 100] */
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Linear interpolation between two score thresholds */
function lerp(value: number, worstVal: number, bestVal: number): number {
  if (bestVal === worstVal) return value <= bestVal ? 100 : 0;
  const t = (value - worstVal) / (bestVal - worstVal);
  return clamp100(t * 100);
}

/**
 * Stability score: how well the key metrics were preserved.
 * Based on volume deviation, sea level rise, and GL position stability.
 */
function stabilityScore(
  state: PhysicsStatePayload,
  initialVolume: number,
): number {
  const volumeDeviation = Math.abs(state.volume - initialVolume) / initialVolume;
  const volumeScore = lerp(volumeDeviation, 0.3, 0); // 0% deviation = 100, 30% = 0

  const slScore = lerp(state.sea_level, 2.0, 0); // 0m rise = 100, 2m = 0

  // Weighted combination
  return volumeScore * 0.6 + slScore * 0.4;
}

/**
 * Efficiency score: fewer parameter changes = more thoughtful.
 * Encourages thinking before acting.
 */
function efficiencyScore(paramChanges: number): number {
  // 0-3 changes = perfect, 20+ = 0
  if (paramChanges <= 3) return 100;
  if (paramChanges >= 20) return 0;
  return clamp100(100 - (paramChanges - 3) * (100 / 17));
}

/**
 * Speed score: how quickly the player achieved a stable state.
 * Normalized against the challenge's duration.
 */
function speedScore(elapsed: number, duration: number): number {
  // Completing in <50% of duration = 100, using full duration = 50
  const ratio = elapsed / duration;
  if (ratio <= 0.5) return 100;
  if (ratio >= 1.0) return 50;
  return clamp100(100 - (ratio - 0.5) * 100);
}

/**
 * Elegance score: challenge-specific bonus criteria.
 */
function eleganceScore(
  challengeId: number,
  state: PhysicsStatePayload,
  initialVolume: number,
  paramChanges: number,
): number {
  switch (challengeId) {
    case 1: {
      // The Balance: volume deviation < 1% = perfect elegance
      const dev = Math.abs(state.volume - initialVolume) / initialVolume;
      return dev < 0.01 ? 100 : dev < 0.03 ? 70 : dev < 0.05 ? 40 : 0;
    }
    case 3: {
      // The Cork: lower sea level rise = more elegant
      return lerp(state.sea_level, 0.5, 0);
    }
    case 6: {
      // The Geoengineers: fewer param changes = minimal intervention
      return paramChanges <= 2 ? 100 : paramChanges <= 5 ? 70 : 30;
    }
    default:
      // Generic: volume preserved well
      return lerp(
        Math.abs(state.volume - initialVolume) / initialVolume,
        0.2, 0
      );
  }
}

/**
 * Compute the total challenge score (0-100).
 */
export function computeScore(
  challenge: ChallengeDefinition,
  state: PhysicsStatePayload,
  initialVolume: number,
  elapsed: number,
  paramChanges: number,
): number {
  const stability = stabilityScore(state, initialVolume);
  const efficiency = efficiencyScore(paramChanges);
  const speed = speedScore(elapsed, challenge.duration_years);
  const elegance = eleganceScore(challenge.id, state, initialVolume, paramChanges);

  const total = Math.round(
    stability * 0.4 +
    efficiency * 0.3 +
    speed * 0.2 +
    elegance * 0.1
  );

  return clamp100(total);
}
