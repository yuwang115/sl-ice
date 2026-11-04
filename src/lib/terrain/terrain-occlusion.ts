/**
 * Terrain occlusion test for flowline picking.
 *
 * The invisible picking tubes are raycast on their own, so without this check
 * a flowline hidden behind a ridge (its visible line is depth-tested away)
 * would still highlight. We march the camera → hit segment over the rendered
 * heightfield instead of raycasting the ~900k-triangle meshes.
 */

import { interpolateGrid, type GridParams } from './projection';

export type Vec3Like = { readonly x: number; readonly y: number; readonly z: number };

/**
 * World-space height of the rendered terrain top at world (x, z), or NaN
 * outside the grid / where nothing is drawn.
 */
export type TerrainHeightSampler = (x: number, z: number) => number;

export interface OcclusionOptions {
  /** Ignore this much of the segment next to the hit (the tube's own radius). */
  readonly endMargin: number;
  /** Terrain must rise this far above the ray (world units) to count as occluding. */
  readonly tolerance: number;
  /** Sampling step along the segment (world units); about half a grid cell. */
  readonly step: number;
}

export const DEFAULT_OCCLUSION_OPTIONS: OcclusionOptions = {
  endMargin: 1.0,
  tolerance: 0.05,
  step: 0.1,
};

/** Hard cap on samples per test, for very long segments. */
const MAX_SAMPLES = 4000;

/**
 * Top of the rendered terrain (m): the ice surface where ice is present and
 * shown, otherwise the bed. NaN where neither is drawn.
 */
export function buildOccluderHeights(
  bed: Float32Array,
  surface: Float32Array,
  thickness: Float32Array,
  includeIce: boolean,
): Float32Array {
  const heights = new Float32Array(bed.length);
  for (let i = 0; i < bed.length; i++) {
    const iceTop = includeIce && thickness[i] > 0 && Number.isFinite(surface[i]) ? surface[i] : -Infinity;
    const bedTop = Number.isFinite(bed[i]) ? bed[i] : -Infinity;
    const top = Math.max(iceTop, bedTop);
    heights[i] = Number.isFinite(top) ? top : NaN;
  }
  return heights;
}

export interface HeightfieldTransform {
  readonly grid: GridParams;
  readonly horizontalMetersPerUnit: number;
  readonly verticalMetersPerUnit: number;
  /** Vertical scale of the terrain group ([1, exaggeration, 1]). */
  readonly exaggeration: number;
}

/** Sampler for a grid of heights (m) rendered with the explorer's scene transform. */
export function createHeightSampler(heights: Float32Array, transform: HeightfieldTransform): TerrainHeightSampler {
  const { grid, horizontalMetersPerUnit: hScale, verticalMetersPerUnit: vScale, exaggeration } = transform;
  const halfX = (grid.nx - 1) / 2;
  const halfY = (grid.ny - 1) / 2;
  const absDy = Math.abs(grid.dy_m);
  const yScale = exaggeration / vScale;

  return (x, z) => {
    const col = (x * hScale) / grid.dx_m + halfX;
    const row = (z * hScale) / absDy + halfY;
    return interpolateGrid(col, row, heights, grid.nx, grid.ny) * yScale;
  };
}

/** True when the terrain rises above the segment from → to (excluding the last endMargin). */
export function isSegmentOccluded(
  from: Vec3Like,
  to: Vec3Like,
  heightAt: TerrainHeightSampler,
  options: OcclusionOptions = DEFAULT_OCCLUSION_OPTIONS,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  const usable = length - options.endMargin;
  if (!(usable > 0) || !(options.step > 0)) return false;

  const samples = Math.min(MAX_SAMPLES, Math.ceil(usable / options.step));
  for (let k = 1; k <= samples; k++) {
    const t = (usable * k) / samples / length;
    const height = heightAt(from.x + dx * t, from.z + dz * t);
    if (Number.isFinite(height) && height > from.y + dy * t + options.tolerance) return true;
  }
  return false;
}
