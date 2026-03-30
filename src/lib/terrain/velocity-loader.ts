/**
 * Fetch and decode Antarctic ice velocity binary data.
 * Returns vx, vy, computed speed, and a validity mask.
 */

import {
  decodeInt16Field,
  findField,
  type DatasetMeta,
} from './binary-decoder';

export interface VelocityData {
  readonly nx: number;
  readonly ny: number;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly speed: Float32Array;
  readonly valid: Uint8Array;
}

/**
 * Load velocity binary + metadata, computing speed magnitude from vx/vy.
 */
export async function loadVelocity(
  basePath = '/3d-ice/data/antarctic_ice_velocity_phase_v01_480',
): Promise<VelocityData> {
  const [metaResponse, binResponse] = await Promise.all([
    fetch(`${basePath}.meta.json`),
    fetch(`${basePath}.bin`),
  ]);

  if (!metaResponse.ok) {
    throw new Error(`Velocity meta fetch failed: ${metaResponse.status}`);
  }
  if (!binResponse.ok) {
    throw new Error(`Velocity bin fetch failed: ${binResponse.status}`);
  }

  const meta: DatasetMeta = await metaResponse.json();
  const buffer = await binResponse.arrayBuffer();

  const { nx, ny } = meta.grid;
  const q = meta.quantization;

  const vxField = findField(meta, 'vx');
  const vyField = findField(meta, 'vy');

  const vx = decodeInt16Field(buffer, vxField, q);
  const vy = decodeInt16Field(buffer, vyField, q);

  const cellCount = nx * ny;
  const speed = new Float32Array(cellCount);
  const valid = new Uint8Array(cellCount);

  for (let i = 0; i < cellCount; i++) {
    const vxVal = vx[i];
    const vyVal = vy[i];
    if (Number.isFinite(vxVal) && Number.isFinite(vyVal)) {
      speed[i] = Math.sqrt(vxVal * vxVal + vyVal * vyVal);
      valid[i] = 1;
    } else {
      speed[i] = 0;
      valid[i] = 0;
    }
  }

  return { nx, ny, vx, vy, speed, valid };
}
