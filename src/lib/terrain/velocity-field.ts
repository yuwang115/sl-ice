/**
 * Velocity field packing for the GPU velocity overlay.
 * Three.js-free so it can run inside the geometry worker.
 */

/** Number of float channels per velocity texel (RGBA). */
export const VELOCITY_TEXEL_CHANNELS = 4;

/**
 * Pack vx / vy / validity into the RGBA32F layout sampled by the velocity
 * surface shader: (vx, vy, valid ? 1 : 0, 0). Invalid cells store zeros.
 */
export function buildVelocityTextureData(
  velocityX: Float32Array,
  velocityY: Float32Array,
  valid: Uint8Array,
): Float32Array {
  const cellCount = valid.length;
  if (velocityX.length !== cellCount || velocityY.length !== cellCount) {
    throw new Error('Velocity components and validity mask must have the same length');
  }

  const data = new Float32Array(cellCount * VELOCITY_TEXEL_CHANNELS);
  for (let i = 0; i < cellCount; i++) {
    if (valid[i] === 0) continue;
    const base = i * VELOCITY_TEXEL_CHANNELS;
    data[base] = velocityX[i];
    data[base + 1] = velocityY[i];
    data[base + 2] = 1;
  }
  return data;
}
