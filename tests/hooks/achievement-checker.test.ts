import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAchievementChecker } from '../../src/hooks/useAchievementChecker';
import { useAchievementStore } from '../../src/store/achievement-store';
import { useGameStore, type ChallengeResult } from '../../src/store/game-store';
import { usePhysicsStore } from '../../src/store/physics-store';
import { gameEvent, physicsState } from '../store/fixtures';

const unlocked = (id: string) => useAchievementStore.getState().isUnlocked(id);

function result(overrides: Partial<ChallengeResult>): ChallengeResult {
  return {
    challengeId: 1, won: true, outcome: 'won', score: 70, stars: 2,
    elapsedYears: 500, paramChanges: 2, photoFinish: false, ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useAchievementStore.setState({ unlocked: {}, pending: null, totalYearsSimulated: 0 });
  useGameStore.setState(useGameStore.getInitialState(), true);
  usePhysicsStore.setState({ state: null, events: [], epoch: 0 });
  renderHook(() => useAchievementChecker());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAchievementChecker', () => {
  it('unlocks The Extremist at the warmest temperature the slider allows', () => {
    useGameStore.getState().setParam('T_atm_delta', 10);
    vi.advanceTimersByTime(1000);
    expect(unlocked('extremist')).toBe(true);
  });

  it('counts simulated years across runs for Time Traveler', () => {
    const sample = (epoch: number, year: number) => {
      usePhysicsStore.setState({ epoch, state: physicsState({ year }) });
      vi.advanceTimersByTime(1000);
    };
    sample(1, 0);
    sample(1, 6000);
    sample(2, 0); // new run: re-baseline, no negative progress
    sample(2, 3000);
    expect(useAchievementStore.getState().totalYearsSimulated).toBe(9000);
    expect(unlocked('time_traveler')).toBe(false);

    sample(2, 4001);
    expect(unlocked('time_traveler')).toBe(true);
  });

  it('awards Photo Finish only for a last-moment win', () => {
    useGameStore.setState({ challengeResult: result({}) });
    expect(unlocked('last_second')).toBe(false);

    useGameStore.setState({ challengeResult: result({ photoFinish: true }) });
    expect(unlocked('last_second')).toBe(true);
  });

  it('awards Light Touch from the parameter count frozen in the result', () => {
    useGameStore.setState({ challengeResult: result({ paramChanges: 1 }) });
    expect(unlocked('zero_intervention')).toBe(true);
  });

  it('withholds Light Touch after more than one adjustment', () => {
    useGameStore.setState({ challengeResult: result({ paramChanges: 2 }) });
    expect(unlocked('zero_intervention')).toBe(false);
  });

  it('catches a one-step city_flooded event', () => {
    usePhysicsStore.setState({ events: [gameEvent('city_flooded')] });
    usePhysicsStore.setState({ events: [] });
    expect(unlocked('sea_level_line')).toBe(true);
  });
});
