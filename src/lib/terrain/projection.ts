/**
 * Coordinate projection utilities for Antarctic Polar Stereographic (EPSG:3031).
 * Converts catalog lon/lat → polar stereographic meters → scene coordinates.
 */

import {
  WGS84_A,
  WGS84_E,
  EPSG3031_STANDARD_PARALLEL,
  FLOWLINE_SURFACE_OFFSET_M,
} from './constants';

// ── EPSG:3031 Projection ─────────────────────────────────────────────
//
// South polar stereographic on WGS84, central meridian λ0 = 0°, true scale
// at φts = −71°:
//     x = ρ·sin λ,   y = ρ·cos λ,   ρ = A·MC·t / TC
// so the prime meridian points along +y, 90°E along +x and 180° along −y.
// t is the conformal latitude parameter of |φ|; MC and TC are the scale
// factor and t at the standard parallel. The generator scripts invert with
// λ = atan2(x, y), so catalog, scenario and outline longitudes are
// geographic longitudes.

const DEG = Math.PI / 180;
const E = WGS84_E;
const A = WGS84_A;
const PHI_TS = Math.abs(EPSG3031_STANDARD_PARALLEL) * DEG; // 71° (positive)

const sinPhiTS = Math.sin(PHI_TS);
/** Scale factor at the standard parallel. */
const MC = Math.cos(PHI_TS) / Math.sqrt(1 - E * E * sinPhiTS * sinPhiTS);
/** Conformal latitude parameter at the standard parallel. */
const TC =
  Math.tan(Math.PI / 4 - PHI_TS / 2) /
  Math.pow((1 - E * sinPhiTS) / (1 + E * sinPhiTS), E / 2);

/**
 * Convert a geographic longitude/latitude (degrees) to EPSG:3031 meters, the
 * (x, y) that indexes the BedMachine grid.
 */
export function lonLatToPS(lon: number, lat: number): { x: number; y: number } {
  const phi = Math.abs(lat) * DEG;       // absolute latitude in radians
  const lambda = lon * DEG;              // longitude in radians
  const sinPhi = Math.sin(phi);

  // Conformal latitude parameter for the point
  const t =
    Math.tan(Math.PI / 4 - phi / 2) /
    Math.pow((1 - E * sinPhi) / (1 + E * sinPhi), E / 2);

  const rho = (A * MC * t) / TC;

  return {
    x: rho * Math.sin(lambda),
    y: rho * Math.cos(lambda),
  };
}

// ── Grid / Scene Coordinate Mapping ──────────────────────────────────

export interface GridParams {
  readonly x0_m: number;
  readonly y0_m: number;
  readonly dx_m: number;
  readonly dy_m: number;
  readonly nx: number;
  readonly ny: number;
}

/**
 * Map polar stereographic coordinates to fractional grid (col, row).
 */
export function psToGrid(
  x_ps: number,
  y_ps: number,
  grid: GridParams,
): { col: number; row: number } {
  return {
    col: (x_ps - grid.x0_m) / grid.dx_m,
    row: (y_ps - grid.y0_m) / grid.dy_m,
  };
}

/**
 * Map fractional grid coordinates to Three.js scene coordinates (x, z).
 * Y (height) is handled separately via surface interpolation.
 */
export function gridToScene(
  col: number,
  row: number,
  grid: GridParams,
  horizontalMetersPerUnit: number,
): { x: number; z: number } {
  const halfX = (grid.nx - 1) / 2;
  const halfY = (grid.ny - 1) / 2;
  const absDy = Math.abs(grid.dy_m);

  return {
    x: ((col - halfX) * grid.dx_m) / horizontalMetersPerUnit,
    z: ((row - halfY) * absDy) / horizontalMetersPerUnit,
  };
}

/**
 * Bilinear interpolation of a grid value at fractional (col, row).
 * Returns NaN outside the grid (col ∉ [0, nx−1] or row ∉ [0, ny−1]). When a
 * surrounding node is invalid it falls back to the nearest node (NaN if that
 * is invalid too).
 */
export function interpolateGrid(
  col: number,
  row: number,
  data: Float32Array,
  nx: number,
  ny: number,
): number {
  // Written as negated "inside" tests so NaN coordinates are rejected too.
  if (!(col >= 0 && col <= nx - 1 && row >= 0 && row <= ny - 1)) return NaN;

  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  const c1 = Math.min(nx - 1, c0 + 1);
  const r1 = Math.min(ny - 1, r0 + 1);

  const fc = col - c0;
  const fr = row - r0;

  const v00 = data[r0 * nx + c0];
  const v10 = data[r0 * nx + c1];
  const v01 = data[r1 * nx + c0];
  const v11 = data[r1 * nx + c1];

  if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) {
    // Fallback: use nearest valid cell
    const nearest = data[Math.round(row) * nx + Math.round(col)];
    return Number.isFinite(nearest) ? nearest : NaN;
  }

  const top = v00 + (v10 - v00) * fc;
  const bot = v01 + (v11 - v01) * fc;
  return top + (bot - top) * fr;
}

/**
 * Project a lon/lat path to 3D scene coordinates, sampling the surface height
 * at each point so flowlines sit on the ice surface.
 */
export function projectFlowlinePath(
  pathLonLat: readonly (readonly [number, number])[],
  grid: GridParams,
  horizontalMetersPerUnit: number,
  verticalMetersPerUnit: number,
  surfaceHeights: Float32Array,
  nx: number,
  ny: number,
): [number, number, number][] {
  const points: [number, number, number][] = [];

  for (const [lon, lat] of pathLonLat) {
    const ps = lonLatToPS(lon, lat);
    const { col, row } = psToGrid(ps.x, ps.y, grid);
    const { x, z } = gridToScene(col, row, grid, horizontalMetersPerUnit);

    const surfaceH = interpolateGrid(col, row, surfaceHeights, nx, ny);
    const y = Number.isFinite(surfaceH)
      ? (surfaceH + FLOWLINE_SURFACE_OFFSET_M) / verticalMetersPerUnit
      : 0;

    points.push([x, y, z]);
  }

  return points;
}
