import { describe, expect, it } from 'vitest';

import {
  clampFrameDelta,
  createSpawnBudget,
  frameSteps,
  MAX_FRAME_DELTA_S,
  normalizeFrameDelta,
  PAUSED_FRAME_INTERVAL_MS,
  REFERENCE_FRAME_S,
  shouldRenderFrame,
  snapSteps,
} from '../../src/renderer/frame-timing';

/** Count drawn frames over one second of vsync ticks at `hz`. */
function drawnFramesPerSecond(hz: number, minIntervalMs: number): number {
  let last: number | null = null;
  let drawn = 0;
  for (let tick = 1; tick <= hz; tick++) {
    const now = (tick * 1000) / hz;
    if (shouldRenderFrame(now, last, minIntervalMs)) {
      drawn++;
      last = now;
    }
  }
  return drawn;
}

describe('clampFrameDelta', () => {
  it('converts milliseconds to seconds', () => {
    expect(clampFrameDelta(16)).toBeCloseTo(0.016);
  });

  it('clamps long frames so particles never teleport', () => {
    expect(clampFrameDelta(5000)).toBe(MAX_FRAME_DELTA_S);
  });

  it('treats negative and non-finite deltas as zero', () => {
    expect(clampFrameDelta(-3)).toBe(0);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
  });
});

describe('frameSteps / snapSteps / normalizeFrameDelta', () => {
  it('expresses frame time in 60 Hz frames', () => {
    expect(frameSteps(REFERENCE_FRAME_S)).toBeCloseTo(1);
    expect(frameSteps(1 / 120)).toBeCloseTo(0.5);
    expect(frameSteps(0)).toBe(0);
  });

  it('snaps near-whole step counts and leaves others alone', () => {
    expect(snapSteps(0.98)).toBe(1);
    expect(snapSteps(2.05)).toBe(2);
    expect(snapSteps(0.5)).toBe(0.5);
    expect(snapSteps(0)).toBe(0);
  });

  it('gives exactly one reference frame for jittery 60 Hz timestamps', () => {
    for (const ms of [16.2, 16.667, 17.1]) {
      expect(frameSteps(normalizeFrameDelta(ms))).toBe(1);
    }
    expect(frameSteps(normalizeFrameDelta(1000 / 120))).toBeCloseTo(0.5);
  });

  it('moves particles the same distance per second at 60 and 120 Hz', () => {
    const speedPerFrame = 2.4; // e.g. 150 m/s × 0.016
    const at60 = 60 * speedPerFrame * frameSteps(normalizeFrameDelta(1000 / 60));
    const at120 = 120 * speedPerFrame * frameSteps(normalizeFrameDelta(1000 / 120));
    expect(at120).toBeCloseTo(at60, 6);
  });
});

describe('shouldRenderFrame', () => {
  it('draws every frame when not throttled', () => {
    expect(drawnFramesPerSecond(60, 0)).toBe(60);
    expect(drawnFramesPerSecond(144, 0)).toBe(144);
  });

  it('throttles the paused loop to about 30 fps at common refresh rates', () => {
    expect(drawnFramesPerSecond(60, PAUSED_FRAME_INTERVAL_MS)).toBe(30);
    expect(drawnFramesPerSecond(120, PAUSED_FRAME_INTERVAL_MS)).toBe(30);
    const at144 = drawnFramesPerSecond(144, PAUSED_FRAME_INTERVAL_MS);
    expect(at144).toBeGreaterThanOrEqual(28);
    expect(at144).toBeLessThanOrEqual(30);
  });

  it('always draws the first frame', () => {
    expect(shouldRenderFrame(5, null, PAUSED_FRAME_INTERVAL_MS)).toBe(true);
  });
});

describe('createSpawnBudget', () => {
  it('spawns the per-frame count every 60 Hz frame', () => {
    const budget = createSpawnBudget();
    for (let i = 0; i < 10; i++) expect(budget.take(4, 1.01)).toBe(4);
  });

  it('keeps the spawn rate per second constant at 120 Hz', () => {
    const budget = createSpawnBudget();
    let total = 0;
    for (let i = 0; i < 120; i++) total += budget.take(3, 0.5);
    expect(total).toBe(180); // 3 per 60 Hz frame × 60
  });

  it('drops the remainder on clear', () => {
    const budget = createSpawnBudget();
    expect(budget.take(1, 0.5)).toBe(0);
    budget.clear();
    expect(budget.take(1, 0.5)).toBe(0);
  });
});
