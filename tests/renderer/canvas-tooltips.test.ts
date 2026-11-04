import { describe, expect, it } from 'vitest';

import { computeShelfMeanThickness, findShelfRange } from '../../src/renderer/draw-canvas-tooltips';
import { computeXPositions } from '../../src/renderer/frame-geometry';

/** Ice profile: grounded inland, a 300 m-thick shelf between 600 and 700 km, then open ocean. */
function buildProfile(domainKm: number, spacingKm: number) {
  const nx = Math.round(domainKm / spacingKm) + 1;
  const xPositions = computeXPositions(domainKm * 1000, nx);
  const H = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    const xKm = xPositions[i] / 1000;
    if (xKm <= 600) H[i] = 1500;
    else if (xKm <= 700) H[i] = 300;
    else H[i] = 0;
  }
  return { H, xPositions, glPositionM: 600_000 };
}

describe('computeShelfMeanThickness', () => {
  it('averages the floating nodes on a 1 km grid', () => {
    const { H, xPositions, glPositionM } = buildProfile(800, 1);
    expect(computeShelfMeanThickness(H, xPositions, glPositionM)).toBeCloseTo(300);
  });

  it('is not zero on a 2 km grid (former ~1 km spacing assumption)', () => {
    const { H, xPositions, glPositionM } = buildProfile(800, 2);
    expect(computeShelfMeanThickness(H, xPositions, glPositionM)).toBeCloseTo(300);
  });

  it('returns 0 without a shelf', () => {
    const { H, xPositions } = buildProfile(800, 2);
    expect(computeShelfMeanThickness(H, xPositions, 900_000)).toBe(0);
  });
});

describe('findShelfRange', () => {
  it('returns the first and last floating node', () => {
    const { H, xPositions, glPositionM } = buildProfile(800, 2);
    const range = findShelfRange(H, xPositions, glPositionM);
    expect(range).not.toBeNull();
    expect(xPositions[range!.start]).toBeGreaterThan(glPositionM);
    expect(xPositions[range!.end]).toBeCloseTo(700_000);
  });

  it('returns null when nothing floats', () => {
    const { H, xPositions } = buildProfile(800, 2);
    expect(findShelfRange(H, xPositions, 800_000)).toBeNull();
  });
});
