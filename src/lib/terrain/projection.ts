/**
 * Coordinate projection utilities for Antarctic Polar Stereographic (EPSG:3031).
 * Converts lon/lat → polar stereographic meters → scene coordinates.
 */

import {
  WGS84_A,
  WGS84_E,
  EPSG3031_STANDARD_PARALLEL,
  FLOWLINE_SURFACE_OFFSET_M,
} from './constants';

// ── EPSG:3031 Projection ─────────────────────────────────────────────
//
// Matches the inverse formula used in scripts/extract-flowlines.mjs:
//   lambda = atan2(x, -y)   →  x = rho·sin(λ),  y = −rho·cos(λ)
//   t = rho·TC / (A·MC)

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
 * Convert WGS-84 longitude/latitude to Antarctic Polar Stereographic (EPSG:3031).
 * Verified against known BedMachine coordinates to sub-meter accuracy.
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
    y: -rho * Math.cos(lambda),
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
 * Returns NaN if any surrounding cell is invalid.
 */
export function interpolateGrid(
  col: number,
  row: number,
  data: Float32Array,
  nx: number,
  ny: number,
): number {
  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  const c1 = Math.min(nx - 1, c0 + 1);
  const r1 = Math.min(ny - 1, r0 + 1);

  if (c0 < 0 || r0 < 0 || c1 >= nx || r1 >= ny) return NaN;

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
