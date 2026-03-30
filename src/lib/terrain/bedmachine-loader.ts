/**
 * Fetch and decode BedMachine Antarctica binary data.
 * Returns decoded Float32Arrays for bed, surface, thickness and Uint8Array mask.
 */

import {
  decodeInt16Field,
  decodeUint8Field,
  findField,
  buildValidityMask,
  type DatasetMeta,
} from './binary-decoder';

export interface TerrainData {
  readonly nx: number;
  readonly ny: number;
  readonly x0_m: number;
  readonly y0_m: number;
  readonly dx_m: number;
  readonly dy_m: number;
  readonly bed: Float32Array;
  readonly surface: Float32Array;
  readonly thickness: Float32Array;
  readonly mask: Uint8Array;
  readonly bedValid: Uint8Array;
  readonly iceValid: Uint8Array;
}

/**
 * Load BedMachine binary + metadata, returning decoded terrain arrays.
 */
export async function loadBedMachine(
  basePath = '/3d-ice/data/bedmachine_antarctica_v4_480',
): Promise<TerrainData> {
  const [metaResponse, binResponse] = await Promise.all([
    fetch(`${basePath}.meta.json`),
    fetch(`${basePath}.bin`),
  ]);

  if (!metaResponse.ok) {
    throw new Error(`BedMachine meta fetch failed: ${metaResponse.status}`);
  }
  if (!binResponse.ok) {
    throw new Error(`BedMachine bin fetch failed: ${binResponse.status}`);
  }

  const meta: DatasetMeta = await metaResponse.json();
  const buffer = await binResponse.arrayBuffer();

  const { nx, ny, x0_m, y0_m, dx_m, dy_m } = meta.grid;
  const q = meta.quantization;

  const bedField = findField(meta, 'bed');
  const surfaceField = findField(meta, 'surface');
  const thicknessField = findField(meta, 'thickness');
  const maskField = findField(meta, 'mask');

  const bed = decodeInt16Field(buffer, bedField, q);
  const surface = decodeInt16Field(buffer, surfaceField, q);
  const thickness = decodeInt16Field(buffer, thicknessField, q);
  const mask = decodeUint8Field(buffer, maskField);

  const bedValid = buildValidityMask(bed);

  // Ice is valid where mask indicates ice coverage and surface is finite
  const cellCount = nx * ny;
  const iceValid = new Uint8Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    const m = mask[i];
    iceValid[i] = (m === 2 || m === 3 || m === 4) && Number.isFinite(surface[i]) ? 1 : 0;
  }

  return { nx, ny, x0_m, y0_m, dx_m, dy_m, bed, surface, thickness, mask, bedValid, iceValid };
}
