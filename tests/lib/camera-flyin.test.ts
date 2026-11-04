import { describe, expect, it } from 'vitest';

import {
  clampFrameDelta,
  computeFlyInEndPosition,
  easeOutQuart,
  FLY_IN_DURATION_S,
  FLY_IN_END_DISTANCE,
  FLY_IN_GLOW_MAX,
  FLY_IN_MAX_FRAME_DELTA_S,
  flyInFrame,
} from '../../src/lib/camera-flyin';
import { getFlowlineFocusPoint } from '../../src/lib/terrain/flowline-focus';
import {
  CAMERA_FAR,
  FOG_FAR,
  ORBIT_MAX_DISTANCE,
  TARGET_WORLD_EXTENT_UNITS,
} from '../../src/lib/terrain/constants';

describe('getFlowlineFocusPoint (sidebar / Simulate fly-in target)', () => {
  const local: [number, number, number][] = [[0, 0.1, 0], [1, 0.5, 2], [2, 0.9, 4]];

  it('scales the local path height by the vertical exaggeration', () => {
    expect(getFlowlineFocusPoint(local, 4.8)).toEqual([1, 0.5 * 4.8, 2]);
  });

  it('matches the rendered line, which sits in a [1, exaggeration, 1] group', () => {
    const [x, y, z] = getFlowlineFocusPoint(local, 2)!;
    expect([x, y, z]).toEqual([local[1][0], local[1][1] * 2, local[1][2]]);
  });

  it('returns null for an empty path', () => {
    expect(getFlowlineFocusPoint([], 4.8)).toBeNull();
  });
});

describe('camera fly-in helpers', () => {
  it('clamps long frames so a compile stall cannot turn the fly-in into a cut', () => {
    expect(clampFrameDelta(3.2)).toBe(FLY_IN_MAX_FRAME_DELTA_S);
    expect(clampFrameDelta(0.016)).toBe(0.016);
    expect(clampFrameDelta(-1)).toBe(0);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
  });

  it('needs many frames to finish even if every frame stalls', () => {
    let elapsed = 0;
    let frames = 0;
    while (flyInFrame(elapsed).positionT < 1) {
      elapsed += clampFrameDelta(2.5); // pathological 2.5 s frames
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(Math.ceil(FLY_IN_DURATION_S / FLY_IN_MAX_FRAME_DELTA_S));
  });

  it('ends FLY_IN_END_DISTANCE from the target along the viewing direction', () => {
    const end = computeFlyInEndPosition([0, 30, 40], [0, 0, 0]);
    expect(Math.hypot(...end)).toBeCloseTo(FLY_IN_END_DISTANCE);
    expect(end[1] / end[2]).toBeCloseTo(30 / 40);
  });

  it('handles a camera already at the target', () => {
    expect(computeFlyInEndPosition([1, 2, 3], [1, 2, 3])).toEqual([1, 2 + FLY_IN_END_DISTANCE, 3]);
  });

  it('eases monotonically and saturates', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
    const a = flyInFrame(0.3);
    const b = flyInFrame(0.6);
    expect(b.positionT).toBeGreaterThan(a.positionT);
    expect(b.lookAtT).toBeGreaterThanOrEqual(b.positionT);
    expect(flyInFrame(10).glow).toBe(FLY_IN_GLOW_MAX);
  });
});

describe('camera / orbit limits', () => {
  it('keeps the whole continent inside the far plane at maximum zoom-out', () => {
    const halfDiagonal = (TARGET_WORLD_EXTENT_UNITS / 2) * Math.SQRT2;
    expect(ORBIT_MAX_DISTANCE + halfDiagonal).toBeLessThanOrEqual(CAMERA_FAR);
  });

  it('fades geometry into the fog before the far plane clips it', () => {
    expect(FOG_FAR).toBeLessThanOrEqual(CAMERA_FAR);
    expect(ORBIT_MAX_DISTANCE).toBeLessThan(FOG_FAR);
  });
});
