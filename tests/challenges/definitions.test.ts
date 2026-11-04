import { describe, expect, it } from 'vitest';

import { challenges } from '../../src/challenges';
import { PARAM_SLIDER_RANGES } from '../../src/store/param-ranges';

describe('challenge definitions', () => {
  it('start from settings the sidebar sliders can reach', () => {
    for (const challenge of challenges) {
      for (const [key, value] of Object.entries(challenge.initial_params)) {
        const range = PARAM_SLIDER_RANGES[key as keyof typeof PARAM_SLIDER_RANGES];
        if (!range || typeof value !== 'number') continue;
        expect(value, `challenge ${challenge.id} ${key}`).toBeGreaterThanOrEqual(range.min);
        expect(value, `challenge ${challenge.id} ${key}`).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('enable hydrology consistently in the definition and its launch params', () => {
    for (const challenge of challenges) {
      const launch = challenge.initial_params.enable_hydrology;
      if (launch !== undefined) expect(launch, `challenge ${challenge.id}`).toBe(challenge.enable_hydrology);
    }
  });
});
