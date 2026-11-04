import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS, selectActiveView, useGameStore } from '../../src/store/game-store';
import { gameEvent, physicsState, scenarioConfig } from './fixtures';

const game = () => useGameStore.getState();

/** Start challenge `id` and feed its baseline state (year 0, volume 1000). */
function beginChallenge(id: number): void {
  game().startChallenge(id);
  game().evaluateChallenge(physicsState({ year: 0, volume: 1000 }));
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('challenge lifecycle', () => {
  it('clears the hysteresis latch when a challenge is retried', () => {
    beginChallenge(2);
    game().evaluateChallenge(physicsState({ year: 1, events: [gameEvent('hysteresis_locked')] }));
    expect(game().challengeResult?.outcome).toBe('lost');

    game().dismissChallengeResult();
    beginChallenge(2);
    game().evaluateChallenge(physicsState({ year: 1 }));

    expect(game()._challengeHysteresisLocked).toBe(false);
    expect(game().challengeResult).toBeNull();
  });

  it("ends a challenge as time's up when the duration passes without a win", () => {
    beginChallenge(1);
    // |dV| = 14.6%: outside the win band (< 5%) yet short of the loss threshold (> 30%)
    game().evaluateChallenge(physicsState({ year: 499.9, volume: 1146 }));
    expect(game().challengeResult).toBeNull();

    game().evaluateChallenge(physicsState({ year: 500, volume: 1146 }));
    expect(game().challengeResult).toMatchObject({
      challengeId: 1, won: false, outcome: 'time_up', score: 0, elapsedYears: 500,
    });
    expect(game().isRunning).toBe(false);
    expect(game().challengeProgress.find((p) => p.id === 1)?.status).toBe('lost');
  });

  it('counts the observational challenge 7 as won once its 2000 years have run', () => {
    beginChallenge(7);
    game().evaluateChallenge(physicsState({ year: 1999 }));
    expect(game().challengeResult).toBeNull();

    game().evaluateChallenge(physicsState({ year: 2000 }));
    expect(game().challengeResult).toMatchObject({ challengeId: 7, won: true, outcome: 'won' });
  });

  it('keeps a won challenge won when it is replayed and then lost or abandoned', () => {
    beginChallenge(1);
    game().evaluateChallenge(physicsState({ year: 500, volume: 1010 }));
    expect(game().challengeResult?.won).toBe(true);
    game().dismissChallengeResult();

    beginChallenge(1);
    expect(game().challengeProgress.find((p) => p.id === 1)?.status).toBe('won');
    game().evaluateChallenge(physicsState({ year: 10, volume: 1400 })); // > 30% change: lost
    expect(game().challengeResult?.won).toBe(false);
    game().completeChallenge(1, false); // abandon path

    const progress = game().challengeProgress.find((p) => p.id === 1);
    expect(progress?.status).toBe('won');
    expect(progress?.bestStars).toBeGreaterThan(0);
  });

  it('flags a photo finish only when the win condition was met inside the final 10 years', () => {
    beginChallenge(1);
    game().evaluateChallenge(physicsState({ year: 490, volume: 1100 })); // 10%: not winning yet
    game().evaluateChallenge(physicsState({ year: 500, volume: 1010 }));
    expect(game().challengeResult).toMatchObject({ won: true, photoFinish: true });

    game().dismissChallengeResult();
    beginChallenge(1);
    game().evaluateChallenge(physicsState({ year: 490, volume: 1010 }));
    game().evaluateChallenge(physicsState({ year: 500, volume: 1010 }));
    expect(game().challengeResult).toMatchObject({ won: true, photoFinish: false });
  });
});

describe('parameters', () => {
  it('does not count launch-time params and counts a slider drag as one adjustment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    game().resetParams({ T_ocean_delta: 2, curtain_position: 400 });
    beginChallenge(6);
    expect(game().challengeParamChanges).toBe(0);

    game().setParam('T_ocean_delta', 1.9);
    vi.advanceTimersByTime(100);
    game().setParam('T_ocean_delta', 1.8); // same drag
    expect(game().challengeParamChanges).toBe(1);

    vi.advanceTimersByTime(500);
    game().setParam('T_ocean_delta', 1.7); // new adjustment after a pause
    game().setParam('curtain_position', 350); // another parameter
    expect(game().challengeParamChanges).toBe(3);
  });

  it('replaces params on challenge launch so earlier overrides do not leak', () => {
    game().resetParams({ enable_mici: true, mici_sensitivity: 2 });
    game().resetParams({ T_ocean_delta: 2 });
    expect(game().params).toEqual({ ...DEFAULT_PARAMS, T_ocean_delta: 2 });
  });

  it('resets params on a mode change but not when re-selecting the current mode', () => {
    game().setMode('sandbox');
    game().setParam('T_atm_delta', 3);
    game().setMode('sandbox');
    expect(game().params.T_atm_delta).toBe(3);

    game().startChallenge(6);
    game().resetParams({ curtain_position: 400, curtain_efficiency: 0.5 });
    game().setMode('real_world');
    expect(game().params).toEqual(DEFAULT_PARAMS);
  });

  it('starts free-play scenarios with their own hydrology default, but not challenges', () => {
    game().setMode('real_world');
    expect(game().paramsForScenario(scenarioConfig({ enable_hydrology: true })).enable_hydrology).toBe(true);
    expect(game().params.enable_hydrology).toBe(true);

    game().resetParams({ enable_hydrology: false });
    game().startChallenge(1);
    expect(game().paramsForScenario(scenarioConfig({ enable_hydrology: true })).enable_hydrology).toBe(false);
  });
});

describe('flowline selection', () => {
  it('enters explorer mode at normal speed when a flowline is picked from the menu', () => {
    game().setMode('menu');
    game().setSpeed('paused');
    game().selectFlowline('recovery-flowline-01');

    expect(game().mode).toBe('explorer');
    expect(game().speed).toBe('normal');
    expect(game().stepsPerFrame).toBe(1);
    expect(selectActiveView(game())).toBe('simulation');
  });

  it('resets params when leaving a flowline for the map', () => {
    game().selectFlowline('recovery-flowline-01');
    game().setParam('precip_scale', 1.5);
    game().selectFlowline(null);
    expect(game().params).toEqual(DEFAULT_PARAMS);
  });
});

describe('selectActiveView', () => {
  it('reports a simulation only when a run is on screen', () => {
    const base = {
      mode: 'explorer' as const,
      currentChallenge: null,
      challengeResult: null,
      selectedRegion: null,
      selectedFlowline: null,
    };
    expect(selectActiveView(base)).toBe('explorer');
    expect(selectActiveView({ ...base, mode: 'menu' })).toBe('explorer');
    expect(selectActiveView({ ...base, mode: 'challenge' })).toBe('challenge_list');
    expect(selectActiveView({ ...base, mode: 'real_world' })).toBe('real_world_selector');
    expect(selectActiveView({ ...base, mode: 'sandbox' })).toBe('simulation');
    expect(selectActiveView({ ...base, mode: 'challenge', currentChallenge: 2 })).toBe('simulation');
    expect(selectActiveView({ ...base, mode: 'real_world', selectedRegion: 'wilkes' })).toBe('simulation');
  });
});

describe('event queue', () => {
  it('keeps one entry per event type with the newest wording, capped at five', () => {
    game().addEvent(gameEvent('city_flooded', ' 1m'));
    game().addEvent(gameEvent('city_flooded', ' 2m'));
    expect(game().pendingEvents).toHaveLength(1);
    expect(game().pendingEvents[0]).toMatchObject({
      message_en: 'city_flooded en 2m',
      message_zh: 'city_flooded zh 2m',
    });

    const types = [
      'shelf_collapsed', 'misi_triggered', 'hysteresis_locked', 'mici_triggered', 'cliff_failure',
    ] as const;
    types.forEach((type) => game().addEvent(gameEvent(type)));

    const queued = game().pendingEvents.map((e) => e.type);
    expect(queued).toHaveLength(5);
    expect(queued[0]).toBe('city_flooded'); // the entry on screen stays
    expect(queued.at(-1)).toBe('cliff_failure');
  });
});
