import { describe, expect, it } from 'vitest';

import { getWheelDollyScale, normalizeWheelDeltaY } from '../../src/lib/wheel-zoom';

describe('normalizeWheelDeltaY', () => {
  it('keeps pixel-mode wheel deltas unchanged', () => {
    expect(normalizeWheelDeltaY({ deltaMode: 0, deltaY: 24, ctrlKey: false })).toBe(24);
  });

  it('scales line-mode and page-mode wheel deltas like the original 3D-ICE viewer', () => {
    expect(normalizeWheelDeltaY({ deltaMode: 1, deltaY: 3, ctrlKey: false })).toBe(48);
    expect(normalizeWheelDeltaY({ deltaMode: 2, deltaY: 2, ctrlKey: false })).toBe(200);
  });

  it('boosts ctrlKey pinch deltas only when Control is not physically held down', () => {
    expect(normalizeWheelDeltaY({ deltaMode: 0, deltaY: -5, ctrlKey: true }, false)).toBe(-50);
    expect(normalizeWheelDeltaY({ deltaMode: 0, deltaY: -5, ctrlKey: true }, true)).toBe(-5);
  });
});

describe('getWheelDollyScale', () => {
  it('uses delta magnitude to produce smaller, smoother trackpad zoom steps', () => {
    expect(getWheelDollyScale(-10, 1)).toBeCloseTo(Math.pow(0.95, 0.1));
    expect(getWheelDollyScale(100, 1)).toBeCloseTo(0.95);
  });
});
