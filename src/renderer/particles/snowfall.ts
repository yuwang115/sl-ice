/**
 * Snowfall particle system.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';

interface Snowflake {
  x: number;  // domain x (m)
  z: number;  // domain z (m)
  vz: number; // fall speed (m/step)
  size: number;
  opacity: number;
}

const MAX_SNOWFLAKES = 200;
let snowflakes: Snowflake[] = [];

/**
 * Update and draw snowfall particles.
 */
export function drawSnowfall(
  dc: DrawContext,
  smb: Float64Array,
  s: Float64Array,
  xPositions: Float64Array,
  precipScale: number,
): void {
  const { ctx, xMax, zMax } = dc;

  // Spawn new snowflakes based on precipitation rate
  const spawnRate = Math.min(10, Math.max(1, precipScale * 5));
  for (let n = 0; n < spawnRate && snowflakes.length < MAX_SNOWFLAKES; n++) {
    const idx = Math.floor(Math.random() * xPositions.length);
    if (smb[idx] > 0) {
      snowflakes.push({
        x: xPositions[idx] + (Math.random() - 0.5) * (xMax / xPositions.length),
        z: zMax + Math.random() * 200,
        vz: -50 - Math.random() * 100,
        size: 1 + Math.random() * 2,
        opacity: 0.4 + Math.random() * 0.6,
      });
    }
  }

  // Update and draw
  const alive: Snowflake[] = [];

  for (const flake of snowflakes) {
    flake.z += flake.vz;
    flake.x += (Math.random() - 0.5) * 20; // Gentle horizontal drift

    // Find surface at this x
    let surfaceZ = 0;
    for (let i = 0; i < xPositions.length - 1; i++) {
      if (xPositions[i] <= flake.x && xPositions[i + 1] > flake.x) {
        const frac = (flake.x - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
        surfaceZ = s[i] * (1 - frac) + s[i + 1] * frac;
        break;
      }
    }

    // Remove if below surface
    if (flake.z < surfaceZ) continue;

    alive.push(flake);

    // Draw
    const cx = toCanvasX(flake.x, dc);
    const cy = toCanvasY(flake.z, dc);

    ctx.beginPath();
    ctx.arc(cx, cy, flake.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
    ctx.fill();
  }

  snowflakes = alive;
}

export function resetSnowfall(): void {
  snowflakes = [];
}
