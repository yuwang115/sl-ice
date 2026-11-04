/**
 * Shared types for the terrain pipeline: the geometry-worker message protocol
 * and the decoded terrain snapshot kept by the explorer store.
 */

import type { DatasetMeta } from './binary-decoder';
import type { RGB } from './color-functions';
import type { LitMeshArrays, VelocityMeshArrays } from './mesh-builder';
import type { GridParams } from './projection';

/** Geometry-build sub-steps reported by the worker (keys for bilingual labels). */
export type TerrainBuildStep =
  | 'decode'
  | 'bedrock'
  | 'ice-surface'
  | 'ice-bottom'
  | 'ice-sides'
  | 'velocity'
  | 'finalize';

/** Every step shown by the loading overlay (fetching + worker build). */
export type TerrainLoadStep = 'fetch' | 'parse' | TerrainBuildStep;

/** Decoded terrain grids and prebuilt mesh arrays for the 3D explorer. */
export interface ExplorerTerrain {
  /** Grid metadata of the BedMachine dataset (origin, spacing, size). */
  readonly grid: GridParams;
  readonly horizontalMetersPerUnit: number;
  readonly verticalMetersPerUnit: number;
  /** Raw elevation grids (m, NaN where missing) for projection / profiles. */
  readonly surfaceHeights: Float32Array;
  readonly bedHeights: Float32Array;
  readonly thicknessData: Float32Array;
  readonly bed: LitMeshArrays;
  readonly ice: LitMeshArrays;
  readonly iceSide: LitMeshArrays;
  readonly iceBottom: LitMeshArrays;
  readonly velocity: VelocityMeshArrays;
}

export interface TerrainBuildRequest {
  readonly type: 'buildAll';
  readonly bedMeta: DatasetMeta;
  readonly bedBuffer: ArrayBuffer;
  readonly velocityMeta: DatasetMeta;
  readonly velocityBuffer: ArrayBuffer;
  readonly oceanLut: readonly RGB[];
  readonly landLut: readonly RGB[];
}

export type TerrainWorkerMessage =
  | { readonly type: 'progress'; readonly step: TerrainBuildStep; readonly progress: number }
  | { readonly type: 'result'; readonly terrain: ExplorerTerrain }
  | { readonly type: 'error'; readonly message: string };

/** Every ArrayBuffer in a terrain snapshot, for zero-copy postMessage transfer. */
export function collectTerrainTransferables(terrain: ExplorerTerrain): ArrayBuffer[] {
  const meshes = [terrain.bed, terrain.ice, terrain.iceSide, terrain.iceBottom];
  const views: ArrayBufferView[] = [
    terrain.surfaceHeights,
    terrain.bedHeights,
    terrain.thicknessData,
    ...meshes.flatMap((mesh) => [mesh.positions, mesh.colors, mesh.indices, mesh.normals]),
    terrain.velocity.positions,
    terrain.velocity.colors,
    terrain.velocity.indices,
    terrain.velocity.uvs,
    terrain.velocity.textureData,
  ];
  const buffers = new Set<ArrayBuffer>();
  for (const view of views) {
    if (view.buffer instanceof ArrayBuffer) buffers.add(view.buffer);
  }
  return [...buffers];
}
