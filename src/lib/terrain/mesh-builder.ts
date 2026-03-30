/**
 * Build surface mesh typed arrays from decoded terrain data.
 * Ported from 3D-ICE explorer's buildSurfaceGeometry().
 *
 * Returns raw Float32Array / Uint8Array / Uint32Array — NOT Three.js objects,
 * so this module can run in a Web Worker or on the main thread.
 */

import type { RGB } from './color-functions';

// ── Types ────────────────────────────────────────────────────────────

export interface MeshArrays {
  readonly positions: Float32Array;
  readonly colors: Uint8Array;
  readonly indices: Uint32Array;
}

export interface BuildSurfaceParams {
  readonly nx: number;
  readonly ny: number;
  readonly dxMeters: number;
  readonly dyMeters: number;
  readonly horizontalMetersPerUnit: number;
  readonly verticalMetersPerUnit: number;
  readonly heights: Float32Array;
  readonly valid: Uint8Array;
  readonly colorFn: (height: number, extra: number, mask: number) => RGB;
  readonly extraField?: Float32Array;
  readonly mask?: Uint8Array;
}

// ── Builder ──────────────────────────────────────────────────────────

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
  const indexList: number[] = [];

  const halfX = (nx - 1) / 2;
  const halfY = (ny - 1) / 2;
  const absDy = Math.abs(dyMeters);

  // ── Vertex pass ──
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const i = row * nx + col;

      const px = ((col - halfX) * dxMeters) / horizontalMetersPerUnit;
      const pz = ((row - halfY) * absDy) / horizontalMetersPerUnit;
      const h = heights[i];
      const isValid = valid[i] === 1;

      positions[3 * i] = px;
      positions[3 * i + 1] = isValid ? h / verticalMetersPerUnit : 0;
      positions[3 * i + 2] = pz;

      const rgb = colorFn(
        h,
        extraField ? extraField[i] : 0,
        mask ? mask[i] : 0,
      );
      colors[3 * i] = Math.round(rgb[0] * 255);
      colors[3 * i + 1] = Math.round(rgb[1] * 255);
      colors[3 * i + 2] = Math.round(rgb[2] * 255);
    }
  }

  // ── Index pass ──
  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const i0 = row * nx + col;
      const i1 = i0 + 1;
      const i2 = i0 + nx;
      const i3 = i2 + 1;

      if (valid[i0] && valid[i2] && valid[i1]) {
        indexList.push(i0, i2, i1);
      }
      if (valid[i1] && valid[i2] && valid[i3]) {
        indexList.push(i1, i2, i3);
      }
    }
  }

  return {
    positions,
    colors,
    indices: new Uint32Array(indexList),
  };
}

// ── Scale helpers ────────────────────────────────────────────────────

import { TARGET_WORLD_EXTENT_UNITS, BASE_HORIZONTAL_VERTICAL_SCALE_RATIO } from './constants';

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
