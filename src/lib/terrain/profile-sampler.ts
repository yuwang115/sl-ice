/**
 * Sample surface, ice-bottom, and bed elevations along a flowline path.
 * Produces the data needed for the cross-section silhouette SVG.
 */

import { lonLatToPS, psToGrid, interpolateGrid, type GridParams } from './projection';

/** A single sample point along the flowline profile. */
export interface ProfileSample {
  /** Cumulative distance from inland start (km). */
  distanceKm: number;
  /** Ice surface elevation (m). */
  surface: number;
  /** Ice bottom elevation (m), = surface − thickness. */
  bottom: number;
  /** Bedrock elevation (m). */
  bed: number;
}

/** Target number of samples in the output (evenly spaced along the path). */
const PROFILE_SAMPLE_TARGET = 80;

function getEvenlySpacedIndices(total: number, target: number): number[] {
  if (total <= target) return Array.from({ length: total }, (_, i) => i);
  const indices: number[] = [0];
  const step = (total - 1) / (target - 1);
  for (let i = 1; i < target - 1; i++) {
    indices.push(Math.round(i * step));
  }
  indices.push(total - 1);
  return indices;
}

/**
 * Sample elevation data along a flowline's lon/lat path.
 *
 * @param pathLonLat  The flowline path as [lon, lat] pairs (inland → coast).
 * @param grid        Grid parameters for the BedMachine dataset.
 * @param surface     Surface elevation grid (Float32Array, nx×ny).
 * @param bedGrid     Bed elevation grid (Float32Array, nx×ny).
 * @param thickness   Ice thickness grid (Float32Array, nx×ny).
 * @param nx          Grid columns.
 * @param ny          Grid rows.
 * @returns           Array of evenly-spaced profile samples, or null if data is insufficient.
 */
export function sampleFlowlineProfile(
  pathLonLat: readonly (readonly [number, number])[],
  grid: GridParams,
  surface: Float32Array,
  bedGrid: Float32Array,
  thickness: Float32Array,
  nx: number,
  ny: number,
): ProfileSample[] | null {
  if (pathLonLat.length < 3) return null;

  // First pass: compute cumulative distances and raw elevations at every path point
  const rawDistances: number[] = [];
  const rawSurface: number[] = [];
  const rawBottom: number[] = [];
  const rawBed: number[] = [];

  let cumulativeM = 0;
  let prevCol = NaN;
  let prevRow = NaN;
  const absDx = Math.abs(grid.dx_m);
  const absDy = Math.abs(grid.dy_m);

  for (let i = 0; i < pathLonLat.length; i++) {
    const [lon, lat] = pathLonLat[i];
    const ps = lonLatToPS(lon, lat);
    const { col, row } = psToGrid(ps.x, ps.y, grid);

    if (i > 0) {
      const dx = (col - prevCol) * absDx;
      const dy = (row - prevRow) * absDy;
      cumulativeM += Math.hypot(dx, dy);
    }

    const surfH = interpolateGrid(col, row, surface, nx, ny);
    const bedH = interpolateGrid(col, row, bedGrid, nx, ny);
    const thickH = interpolateGrid(col, row, thickness, nx, ny);

    if (!Number.isFinite(surfH)) {
      prevCol = col;
      prevRow = row;
      continue;
    }

    const s = surfH;
    const thick = Number.isFinite(thickH) && thickH > 0 ? thickH : 0;
    let bot = s - thick;
    let bed = Number.isFinite(bedH) ? bedH : bot;
    if (bot > s) bot = s;
    if (bed > bot) bed = bot;

    rawDistances.push(cumulativeM / 1000);
    rawSurface.push(s);
    rawBottom.push(bot);
    rawBed.push(bed);

    prevCol = col;
    prevRow = row;
  }

  if (rawSurface.length < 3) return null;

  // Second pass: downsample to evenly spaced indices
  const sampleIndices = getEvenlySpacedIndices(rawSurface.length, PROFILE_SAMPLE_TARGET);
  return sampleIndices.map((idx) => ({
    distanceKm: rawDistances[idx],
    surface: rawSurface[idx],
    bottom: rawBottom[idx],
    bed: rawBed[idx],
  }));
}
