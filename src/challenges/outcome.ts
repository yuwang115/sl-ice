/**
 * Challenge outcome rules shared by the game store and its tests.
 */

import type { ChallengeDefinition, ModelState, PhysicsStatePayload } from '../engine/types';

/** How an attempt ended. 'time_up': the duration ran out without the win condition. */
export type ChallengeOutcome = 'won' | 'lost' | 'time_up';

/** Final stretch of a challenge (model years) that counts as a photo finish. */
export const PHOTO_FINISH_WINDOW_YEARS = 10;

/** The part of the model state the win/lose checks read. */
export type ChallengeCheckState = Pick<
  ModelState,
  | 'volume' | 'initial_volume' | 'sea_level' | 'is_misi_active' | 'hysteresis_locked'
  | 'is_mici_active' | 'cliff_height' | 'mici_calving_rate'
> & { shelf_exists: boolean };

export function buildCheckState(
  payload: PhysicsStatePayload,
  initialVolume: number,
  hysteresisLocked: boolean,
): ChallengeCheckState {
  return {
    volume: payload.volume,
    initial_volume: initialVolume,
    sea_level: payload.sea_level,
    is_misi_active: payload.is_misi_active,
    hysteresis_locked: hysteresisLocked,
    is_mici_active: payload.is_mici_active,
    cliff_height: payload.cliff_height,
    mici_calving_rate: payload.mici_calving_rate,
    shelf_exists: payload.shelf_exists,
  };
}

/** check_win/check_lose are typed against ModelState but only read ChallengeCheckState fields. */
function asModelState(state: ChallengeCheckState): ModelState {
  return state as unknown as ModelState;
}

/**
 * Outcome of an attempt at `elapsed` model years, or null while it is still
 * running. Every challenge ends at its duration: if the win condition does
 * not hold by then, time is up.
 */
export function resolveChallengeOutcome(
  challenge: ChallengeDefinition,
  state: ChallengeCheckState,
  elapsed: number,
): ChallengeOutcome | null {
  const model = asModelState(state);
  if (challenge.check_win(model, elapsed)) return 'won';
  if (challenge.check_lose(model, elapsed)) return 'lost';
  if (elapsed >= challenge.duration_years) return 'time_up';
  return null;
}

/**
 * Whether the win condition (time requirement aside) holds once the final
 * PHOTO_FINISH_WINDOW_YEARS begin; null before that point.
 */
export function winConditionAtFinalStretch(
  challenge: ChallengeDefinition,
  state: ChallengeCheckState,
  elapsed: number,
): boolean | null {
  if (elapsed < challenge.duration_years - PHOTO_FINISH_WINDOW_YEARS) return null;
  return challenge.check_win(asModelState(state), challenge.duration_years);
}
