/**
 * Terrain build pipeline: decode the BedMachine / velocity grids and build
 * every explorer mesh (with vertex normals) plus the velocity texture data.
 *
 * Pure and synchronous — runs inside the geometry worker, and in unit tests.
 */

import { decodeInt16Field, decodeUint8Field, findField, type DatasetMeta } from './binary-decoder';
import { bedColor, iceBottomColor, iceColor, isIceCovered, velocityColor } from './color-functions';
import { FLOWLINE_SURFACE_OFFSET_M } from './constants';
import { computeVertexNormals } from './grid-normals';
import {
  buildGridUvs,
  buildIceSideArrays,
  buildSurfaceArrays,
  computeScaleFactors,
  type GridGeometryParams,
  type LitMeshArrays,
  type MeshArrays,
  type VelocityMeshArrays,
} from './mesh-builder';
import type { ExplorerTerrain, TerrainBuildRequest, TerrainBuildStep } from './terrain-types';
import { buildVelocityTextureData } from './velocity-field';

export type BuildProgressFn = (step: TerrainBuildStep, progress: number) => void;

interface DecodedBed {
  readonly bed: Float32Array;
  readonly surface: Float32Array;
  readonly thickness: Float32Array;
  readonly mask: Uint8Array;
}

function withNormals(mesh: MeshArrays): LitMeshArrays {
  return { ...mesh, normals: computeVertexNormals(mesh.positions, mesh.indices) };
}

function decodeBed(meta: DatasetMeta, buffer: ArrayBuffer): DecodedBed {
  const q = meta.quantization;
  const cellCount = meta.grid.nx * meta.grid.ny;
  const maskField = meta.fields.find((f) => f.name === 'mask');
  const decoded = {
    bed: decodeInt16Field(buffer, findField(meta, 'bed'), q),
    surface: decodeInt16Field(buffer, findField(meta, 'surface'), q),
    thickness: decodeInt16Field(buffer, findField(meta, 'thickness'), q),
    mask: maskField ? decodeUint8Field(buffer, maskField) : new Uint8Array(cellCount),
  };
  for (const [name, field] of Object.entries(decoded)) {
    if (field.length !== cellCount) {
      throw new Error(`BedMachine field "${name}" has ${field.length} cells, expected ${cellCount}`);
    }
  }
  return decoded;
}

/** Ice base elevation (surface − thickness) where ice is present, else NaN. */
function computeIceBase(decoded: DecodedBed, iceValid: Uint8Array): { heights: Float32Array; valid: Uint8Array } {
  const { surface, thickness } = decoded;
  const heights = new Float32Array(surface.length);
  const valid = new Uint8Array(surface.length);
  for (let i = 0; i < surface.length; i++) {
    const base = surface[i] - thickness[i];
    if (iceValid[i] && thickness[i] > 0 && Number.isFinite(base)) {
      heights[i] = base;
      valid[i] = 1;
    } else {
      heights[i] = NaN;
    }
  }
  return { heights, valid };
}

function buildVelocity(
  meta: DatasetMeta,
  buffer: ArrayBuffer,
  surface: Float32Array,
  iceValid: Uint8Array,
  geometry: GridGeometryParams,
): VelocityMeshArrays {
  const cellCount = surface.length;
  const vx = decodeInt16Field(buffer, findField(meta, 'vx'), meta.quantization);
  const vy = decodeInt16Field(buffer, findField(meta, 'vy'), meta.quantization);
  if (vx.length !== cellCount || vy.length !== cellCount) {
    throw new Error('Velocity grid does not match the BedMachine grid');
  }

  const speed = new Float32Array(cellCount);
  const valid = new Uint8Array(cellCount);
  const heights = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    if (Number.isFinite(vx[i]) && Number.isFinite(vy[i]) && iceValid[i]) {
      speed[i] = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
      valid[i] = 1;
      heights[i] = surface[i] + FLOWLINE_SURFACE_OFFSET_M;
    } else {
      heights[i] = NaN;
    }
  }

  const mesh = buildSurfaceArrays({
    ...geometry, heights, valid, extraField: speed,
    colorFn: (_h, extra) => velocityColor(extra),
  });
  return {
    ...mesh,
    uvs: buildGridUvs(geometry.nx, geometry.ny),
    textureData: buildVelocityTextureData(vx, vy, valid),
  };
}

/** Run the full terrain build, reporting progress (0–1) per step. */
export function buildTerrain(request: TerrainBuildRequest, onProgress: BuildProgressFn): ExplorerTerrain {
  onProgress('decode', 0.1);
  const { grid } = request.bedMeta;
  const decoded = decodeBed(request.bedMeta, request.bedBuffer);
  const { bed, surface, thickness, mask } = decoded;

  onProgress('bedrock', 0.3);
  const cellCount = grid.nx * grid.ny;
  const bedValid = new Uint8Array(cellCount);
  const iceValid = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    bedValid[i] = Number.isFinite(bed[i]) ? 1 : 0;
    iceValid[i] = isIceCovered(mask[i]) && Number.isFinite(surface[i]) ? 1 : 0;
  }
  const scales = computeScaleFactors(grid.nx, grid.ny, grid.dx_m, grid.dy_m);
  const geometry: GridGeometryParams = {
    nx: grid.nx, ny: grid.ny, dxMeters: grid.dx_m, dyMeters: grid.dy_m, ...scales,
  };
  const { oceanLut, landLut } = request;
  const bedMesh = withNormals(buildSurfaceArrays({
    ...geometry, heights: bed, valid: bedValid, colorFn: (h) => bedColor(h, oceanLut, landLut),
  }));

  onProgress('ice-surface', 0.5);
  const iceMesh = withNormals(buildSurfaceArrays({
    ...geometry, heights: surface, valid: iceValid, extraField: thickness, mask,
    colorFn: (_h, extra, m) => iceColor(extra, m),
  }));

  onProgress('ice-bottom', 0.6);
  const iceBase = computeIceBase(decoded, iceValid);
  const iceBottomMesh = withNormals(buildSurfaceArrays({
    ...geometry, heights: iceBase.heights, valid: iceBase.valid, extraField: thickness, mask,
    colorFn: (_h, extra, m) => iceBottomColor(extra, m),
  }));

  onProgress('ice-sides', 0.65);
  const iceSideMesh = withNormals(buildIceSideArrays({
    ...geometry, topHeights: surface, bottomHeights: iceBase.heights, valid: iceValid,
    extraField: thickness, mask, colorFn: (_h, extra, m) => iceColor(extra, m),
  }));

  onProgress('velocity', 0.7);
  const velocity = buildVelocity(request.velocityMeta, request.velocityBuffer, surface, iceValid, geometry);

  onProgress('finalize', 0.9);
  return {
    grid: { ...grid },
    ...scales,
    surfaceHeights: surface,
    bedHeights: bed,
    thicknessData: thickness,
    bed: bedMesh,
    ice: iceMesh,
    iceSide: iceSideMesh,
    iceBottom: iceBottomMesh,
    velocity,
  };
}
