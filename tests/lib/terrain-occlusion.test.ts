import { describe, expect, it } from 'vitest';

import {
  buildOccluderHeights,
  createHeightSampler,
  isSegmentOccluded,
} from '../../src/lib/terrain/terrain-occlusion';
import type { GridParams } from '../../src/lib/terrain/projection';

describe('buildOccluderHeights', () => {
  it('uses the ice surface where ice is shown, else the bed', () => {
    const bed = new Float32Array([-500, 100, Number.NaN, Number.NaN]);
    const surface = new Float32Array([800, 900, 700, Number.NaN]);
    const thickness = new Float32Array([1300, 0, 50, 0]);
    expect(Array.from(buildOccluderHeights(bed, surface, thickness, true))).toEqual([800, 100, 700, Number.NaN]);
    expect(Array.from(buildOccluderHeights(bed, surface, thickness, false))).toEqual([-500, 100, Number.NaN, Number.NaN]);
  });
});

describe('createHeightSampler', () => {
  it('maps world x/z to grid nodes and scales height like the terrain group', () => {
    const grid: GridParams = { x0_m: 0, y0_m: 0, dx_m: 1000, dy_m: -1000, nx: 3, ny: 3 };
    const heights = new Float32Array([0, 0, 0, 0, 380, 0, 0, 0, 0]);
    const heightAt = createHeightSampler(heights, {
      grid, horizontalMetersPerUnit: 1000, verticalMetersPerUnit: 100, exaggeration: 2,
    });
    expect(heightAt(0, 0)).toBeCloseTo(7.6); // centre node: 380 m / 100 m·unit⁻¹ × 2
    expect(heightAt(1, 1)).toBeCloseTo(0);   // corner node
    expect(heightAt(5, 0)).toBeNaN();        // outside the grid
  });
});

describe('isSegmentOccluded', () => {
  const flat = () => 0;
  const ridge = (x: number) => (Math.abs(x - 5) < 0.5 ? 10 : 0);

  it('is false over flat terrain', () => {
    expect(isSegmentOccluded({ x: 0, y: 20, z: 0 }, { x: 10, y: 0.5, z: 0 }, flat)).toBe(false);
  });

  it('is true when a ridge rises between the camera and the hit', () => {
    expect(isSegmentOccluded({ x: 0, y: 6, z: 0 }, { x: 10, y: 0.5, z: 0 }, ridge)).toBe(true);
  });

  it('ignores terrain right next to the hit (the picking tube radius)', () => {
    // Terrain rises above the ray only within 0.5 units of the hit.
    const nearHit = (x: number) => (x > 9.5 ? 3 : 0);
    expect(isSegmentOccluded({ x: 0, y: 2, z: 0 }, { x: 10, y: 1, z: 0 }, nearHit)).toBe(false);
  });

  it('treats missing terrain (NaN) as open', () => {
    expect(isSegmentOccluded({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, () => Number.NaN)).toBe(false);
  });
});
