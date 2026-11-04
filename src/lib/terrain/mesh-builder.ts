/**
 * Build terrain mesh typed arrays from decoded grid fields.
 * Ported from 3D-ICE explorer's buildSurfaceGeometry().
 *
 * Returns raw typed arrays — NOT Three.js objects — so this module runs in
 * the geometry Web Worker (its runtime caller) and in unit tests.
 */

import type { RGB } from './color-functions';
import { TARGET_WORLD_EXTENT_UNITS, BASE_HORIZONTAL_VERTICAL_SCALE_RATIO } from './constants';

// ── Types ────────────────────────────────────────────────────────────

export interface MeshArrays {
  readonly positions: Float32Array;
  readonly colors: Uint8Array;
  readonly indices: Uint32Array;
}

/** Mesh arrays for lit materials, with precomputed vertex normals. */
export interface LitMeshArrays extends MeshArrays {
  readonly normals: Float32Array;
}

export interface VelocityMeshArrays extends MeshArrays {
  readonly uvs: Float32Array;
  /** RGBA32F texels (vx, vy, valid, 0) for the velocity surface shader, nx × ny. */
  readonly textureData: Float32Array;
}

export type TerrainColorFn = (height: number, extra: number, mask: number) => RGB;

export interface GridGeometryParams {
  readonly nx: number;
  readonly ny: number;
  readonly dxMeters: number;
  readonly dyMeters: number;
  readonly horizontalMetersPerUnit: number;
  readonly verticalMetersPerUnit: number;
}

export interface BuildSurfaceParams extends GridGeometryParams {
  readonly heights: Float32Array;
  readonly valid: Uint8Array;
  readonly colorFn: TerrainColorFn;
  readonly extraField?: Float32Array;
  readonly mask?: Uint8Array;
}

export interface BuildSideParams extends GridGeometryParams {
  readonly topHeights: Float32Array;
  readonly bottomHeights: Float32Array;
  readonly valid: Uint8Array;
  readonly colorFn: TerrainColorFn;
  readonly extraField?: Float32Array;
  readonly mask?: Uint8Array;
}

type Vec3 = [number, number, number];

function writeColor(colors: Uint8Array, offset: number, rgb: RGB): void {
  colors[offset] = Math.round(rgb[0] * 255);
  colors[offset + 1] = Math.round(rgb[1] * 255);
  colors[offset + 2] = Math.round(rgb[2] * 255);
}

/**
 * Triangulate every grid cell whose corners are valid (two triangles per
 * cell, split along the i1–i2 diagonal).
 */
function buildGridIndices(nx: number, ny: number, valid: Uint8Array): Uint32Array {
  const indices = new Uint32Array(Math.max(0, (nx - 1) * (ny - 1) * 6));
  let n = 0;
  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const i0 = row * nx + col;
      const i1 = i0 + 1;
      const i2 = i0 + nx;
      const i3 = i2 + 1;
      if (valid[i0] && valid[i2] && valid[i1]) {
        indices[n++] = i0; indices[n++] = i2; indices[n++] = i1;
      }
      if (valid[i1] && valid[i2] && valid[i3]) {
        indices[n++] = i1; indices[n++] = i2; indices[n++] = i3;
      }
    }
  }
  return indices.slice(0, n);
}

// ── Surface builder ──────────────────────────────────────────────────

/**
 * Build surface mesh arrays identical to the 3D-ICE `buildSurfaceGeometry`.
 */
export function buildSurfaceArrays(params: BuildSurfaceParams): MeshArrays {
  const {
    nx, ny,
    dxMeters, dyMeters,
    horizontalMetersPerUnit,
    verticalMetersPerUnit,
    heights, valid,
    colorFn,
    extraField, mask,
  } = params;

  const vertexCount = nx * ny;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 3);

  const halfX = (nx - 1) / 2;
  const halfY = (ny - 1) / 2;
  const absDy = Math.abs(dyMeters);

  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const i = row * nx + col;
      const h = heights[i];

      positions[3 * i] = ((col - halfX) * dxMeters) / horizontalMetersPerUnit;
      positions[3 * i + 1] = valid[i] ? h / verticalMetersPerUnit : 0;
      positions[3 * i + 2] = ((row - halfY) * absDy) / horizontalMetersPerUnit;

      writeColor(colors, 3 * i, colorFn(h, extraField ? extraField[i] : 0, mask ? mask[i] : 0));
    }
  }

  return { positions, colors, indices: buildGridIndices(nx, ny, valid) };
}

/** Per-vertex UVs spanning the grid (0..1 along columns and rows). */
export function buildGridUvs(nx: number, ny: number): Float32Array {
  const uvs = new Float32Array(nx * ny * 2);
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const i = row * nx + col;
      uvs[2 * i] = col / Math.max(1, nx - 1);
      uvs[2 * i + 1] = row / Math.max(1, ny - 1);
    }
  }
  return uvs;
}

// ── Side-wall builder ────────────────────────────────────────────────

interface EdgeRecord {
  readonly a: number;
  readonly b: number;
  count: number;
}

/** Count how many valid triangles share each grid edge (boundary edges have one). */
function collectTriangleEdges(nx: number, ny: number, valid: Uint8Array): Map<number, EdgeRecord> {
  const cellCount = nx * ny;
  const edges = new Map<number, EdgeRecord>();
  const addEdge = (a: number, b: number) => {
    const key = a < b ? a * cellCount + b : b * cellCount + a;
    const existing = edges.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    edges.set(key, { a, b, count: 1 });
  };

  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const i0 = row * nx + col;
      const i1 = i0 + 1;
      const i2 = i0 + nx;
      const i3 = i2 + 1;
      if (valid[i0] && valid[i2] && valid[i1]) {
        addEdge(i0, i2); addEdge(i2, i1); addEdge(i1, i0);
      }
      if (valid[i1] && valid[i2] && valid[i3]) {
        addEdge(i1, i2); addEdge(i2, i3); addEdge(i3, i1);
      }
    }
  }
  return edges;
}

/**
 * Build vertical side walls along the outer boundary of the valid ice region,
 * spanning from the top surface down to the ice base (non-indexed quads).
 */
export function buildIceSideArrays(params: BuildSideParams): MeshArrays {
  const {
    nx, dxMeters, dyMeters, horizontalMetersPerUnit: hScale, verticalMetersPerUnit: vScale,
    topHeights, bottomHeights, valid, colorFn, extraField, mask,
  } = params;
  const halfX = (nx - 1) / 2;
  const halfY = (params.ny - 1) / 2;
  const absDy = Math.abs(dyMeters);

  const positions: number[] = [];
  const colors: number[] = [];

  const vertexAt = (index: number, heights: Float32Array): Vec3 => {
    const row = Math.floor(index / nx);
    const col = index % nx;
    return [((col - halfX) * dxMeters) / hScale, heights[index] / vScale, ((row - halfY) * absDy) / hScale];
  };
  const colorAt = (index: number): Vec3 => {
    const rgb = colorFn(topHeights[index], extraField ? extraField[index] : 0, mask ? mask[index] : 0);
    return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
  };
  const push = (point: Vec3, color: Vec3) => {
    positions.push(point[0], point[1], point[2]);
    colors.push(color[0], color[1], color[2]);
  };
  const isFiniteAt = (index: number) =>
    Number.isFinite(topHeights[index]) && Number.isFinite(bottomHeights[index]);

  collectTriangleEdges(nx, params.ny, valid).forEach(({ a, b, count }) => {
    if (count !== 1 || !isFiniteAt(a) || !isFiniteAt(b)) return;
    const topA = vertexAt(a, topHeights);
    const topB = vertexAt(b, topHeights);
    const botA = vertexAt(a, bottomHeights);
    const botB = vertexAt(b, bottomHeights);
    const cA = colorAt(a);
    const cB = colorAt(b);
    push(topA, cA); push(topB, cB); push(botA, cA);
    push(topB, cB); push(botB, cB); push(botA, cA);
  });

  const vertexCount = positions.length / 3;
  const indices = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) indices[i] = i;

  return {
    positions: new Float32Array(positions),
    colors: new Uint8Array(colors),
    indices,
  };
}

// ── Scale helpers ────────────────────────────────────────────────────

/**
 * Compute horizontal and vertical meters-per-unit from grid metadata.
 * Matches 3D-ICE's scale computation exactly.
 */
export function computeScaleFactors(
  nx: number,
  ny: number,
  dxMeters: number,
  dyMeters: number,
): { horizontalMetersPerUnit: number; verticalMetersPerUnit: number } {
  const widthMeters = Math.abs(dxMeters) * Math.max(1, nx - 1);
  const depthMeters = Math.abs(dyMeters) * Math.max(1, ny - 1);
  const horizontalMetersPerUnit = Math.max(
    1,
    Math.max(widthMeters, depthMeters) / TARGET_WORLD_EXTENT_UNITS,
  );
  const verticalMetersPerUnit = Math.max(
    1,
    horizontalMetersPerUnit / BASE_HORIZONTAL_VERTICAL_SCALE_RATIO,
  );
  return { horizontalMetersPerUnit, verticalMetersPerUnit };
}
