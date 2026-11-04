/**
 * Snowfall particle system.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';
import { createSpawnBudget, frameSteps, REFERENCE_FRAME_S } from '../frame-timing';

interface Snowflake {
  x: number;  // domain x (m)
  z: number;  // domain z (m)
  vz: number; // fall speed (m per 60 Hz frame)
  size: number;
  opacity: number;
}

const MAX_SNOWFLAKES = 200;
let snowflakes: Snowflake[] = [];
const spawnBudget = createSpawnBudget();

function spawnSnowflakes(
  smb: Float64Array,
  xPositions: Float64Array,
  xMax: number,
  zMax: number,
  precipScale: number,
  steps: number,
): void {
  // The former loop ran ceil(rate) spawn attempts per frame.
  const attemptsPerFrame = Math.ceil(Math.min(10, Math.max(1, precipScale * 5)));
  const due = spawnBudget.take(attemptsPerFrame, steps);
  for (let n = 0; n < due && snowflakes.length < MAX_SNOWFLAKES; n++) {
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
  if (snowflakes.length >= MAX_SNOWFLAKES) spawnBudget.clear();
}

/**
 * Update and draw snowfall particles. `dt` is the frame time in seconds.
 */
export function drawSnowfall(
  dc: DrawContext,
  smb: Float64Array,
  s: Float64Array,
  xPositions: Float64Array,
  precipScale: number,
  dt: number = REFERENCE_FRAME_S,
): void {
  const { ctx, xMax, zMax } = dc;
  const steps = frameSteps(dt);

  // Spawn new snowflakes based on precipitation rate
  spawnSnowflakes(smb, xPositions, xMax, zMax, precipScale, steps);

  // Update and draw
  const alive: Snowflake[] = [];

  for (const flake of snowflakes) {
    flake.z += flake.vz * steps;
    flake.x += (Math.random() - 0.5) * 20 * steps; // Gentle horizontal drift

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
  spawnBudget.clear();
}
