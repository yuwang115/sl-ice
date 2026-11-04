import { describe, expect, it } from 'vitest';

import { barrierGeometry } from '../../src/renderer/draw-barrier';

const x = new Float64Array([0, 100_000, 200_000, 300_000]);
const b = new Float64Array([200, -200, -600, -1000]);

describe('barrierGeometry', () => {
  it('is absent without a curtain', () => {
    expect(barrierGeometry(undefined, b, x)).toBeNull();
  });

  it('stands on the interpolated seafloor and spans half the water column', () => {
    const g = barrierGeometry(250, b, x);
    expect(g).not.toBeNull();
    expect(g!.x).toBe(250_000);
    expect(g!.bed).toBeCloseTo(-800);
    expect(g!.top).toBeCloseTo(-400);
  });

  it('is not drawn on dry land or outside the profile', () => {
    expect(barrierGeometry(20, b, x)).toBeNull(); // bed above sea level
    expect(barrierGeometry(400, b, x)).toBeNull();
  });
});
