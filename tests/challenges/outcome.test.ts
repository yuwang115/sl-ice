import { describe, expect, it } from 'vitest';

import { challenges } from '../../src/challenges';
import {
  buildCheckState, resolveChallengeOutcome, winConditionAtFinalStretch,
} from '../../src/challenges/outcome';
import { physicsState } from '../store/fixtures';

const challenge = (id: number) => {
  const found = challenges.find((c) => c.id === id);
  if (!found) throw new Error(`challenge ${id} missing`);
  return found;
};

const checkState = (volume: number, initialVolume = 1000) =>
  buildCheckState(physicsState({ volume }), initialVolume, false);

describe('resolveChallengeOutcome', () => {
  it('keeps a challenge running before its duration when neither condition holds', () => {
    expect(resolveChallengeOutcome(challenge(1), checkState(1146), 250)).toBeNull();
  });

  it('ends every challenge at its duration', () => {
    for (const c of challenges) {
      // Whatever the state, no challenge may outlast its duration.
      const outcome = resolveChallengeOutcome(c, checkState(1146), c.duration_years);
      expect(outcome, `challenge ${c.id}`).not.toBeNull();
    }
    expect(resolveChallengeOutcome(challenge(1), checkState(1146), 500)).toBe('time_up');
    expect(resolveChallengeOutcome(challenge(7), checkState(1146), 2000)).toBe('won');
  });

  it('prefers a loss over the time limit', () => {
    expect(resolveChallengeOutcome(challenge(1), checkState(1400), 500)).toBe('lost');
  });
});

describe('winConditionAtFinalStretch', () => {
  it('is unknown before the last 10 years and evaluates the win state inside them', () => {
    expect(winConditionAtFinalStretch(challenge(1), checkState(1010), 489)).toBeNull();
    expect(winConditionAtFinalStretch(challenge(1), checkState(1010), 490)).toBe(true);
    expect(winConditionAtFinalStretch(challenge(1), checkState(1100), 490)).toBe(false);
  });
});
