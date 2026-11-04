/**
 * Unlocks achievements. Progress-based conditions are polled at 1 Hz;
 * challenge results and physics events are handled as they happen, so
 * short-lived values (a result dismissed within a second, an event carried
 * by a single physics step) are not missed.
 */

import { useEffect } from 'react';
import { useGameStore, type ChallengeResult } from '../store/game-store';
import { usePhysicsStore } from '../store/physics-store';
import { useAchievementStore, TIME_TRAVELER_YEARS } from '../store/achievement-store';
import { PARAM_SLIDER_RANGES } from '../store/param-ranges';

const POLL_INTERVAL_MS = 1000;

function checkProgressAchievements(): void {
  const { unlock, totalYearsSimulated } = useAchievementStore.getState();
  const game = useGameStore.getState();
  const progress = game.challengeProgress;
  const wonIds = progress.filter((p) => p.status === 'won').map((p) => p.id);

  // Beginner
  if (wonIds.length >= 1) unlock('first_win');
  if (progress.some((p) => p.status === 'lost')) unlock('first_fail');
  if ((progress.find((p) => p.id === 1)?.bestStars ?? 0) >= 3) unlock('steady_rock');
  if (wonIds.includes(7)) unlock('patient_observer');

  // Explorer
  if (totalYearsSimulated > TIME_TRAVELER_YEARS) unlock('time_traveler');
  if (game.params.T_atm_delta >= PARAM_SLIDER_RANGES.T_atm_delta.max) unlock('extremist');
  if (wonIds.includes(6)) unlock('geoengineer');

  // Mastery
  if (progress.some((p) => (p.bestScore ?? 0) >= 100)) unlock('hundred');
  if (wonIds.length >= 8) unlock('all_clear');
  if (wonIds.length >= 8 && progress.every((p) => (p.bestStars ?? 0) >= 3)) unlock('grand_master');

  // Hidden
  if (wonIds.includes(5)) unlock('impossible_mission');
}

function checkResultAchievements(result: ChallengeResult): void {
  const { unlock } = useAchievementStore.getState();
  if (!result.won) {
    // Also covers failing a replay of an already-won challenge (its status stays 'won').
    unlock('first_fail');
    return;
  }
  // The Balance starts off balance, so it takes at least one adjustment.
  if (result.challengeId === 1 && result.paramChanges === 1) unlock('zero_intervention');
  if (result.photoFinish) unlock('last_second');
}

/** Accumulate simulated model years; a new scenario epoch restarts the baseline. */
function createYearCounter(): () => void {
  let last: { epoch: number; year: number } | null = null;
  return () => {
    const { epoch, state } = usePhysicsStore.getState();
    if (!state) return;
    if (last && last.epoch === epoch) {
      useAchievementStore.getState().addSimulatedYears(state.year - last.year);
    }
    last = { epoch, year: state.year };
  };
}

export function useAchievementChecker() {
  useEffect(() => {
    const countYears = createYearCounter();
    const interval = setInterval(() => {
      countYears();
      checkProgressAchievements();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => useGameStore.subscribe((s, prev) => {
    if (s.challengeResult && s.challengeResult !== prev.challengeResult) {
      checkResultAchievements(s.challengeResult);
    }
  }), []);

  useEffect(() => usePhysicsStore.subscribe((s, prev) => {
    if (s.events !== prev.events && s.events.some((e) => e.type === 'city_flooded')) {
      useAchievementStore.getState().unlock('sea_level_line');
    }
  }), []);
}
