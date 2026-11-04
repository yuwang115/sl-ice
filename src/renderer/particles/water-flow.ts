/**
 * Subglacial water flow particle system.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';
import { frameSteps, REFERENCE_FRAME_S } from '../frame-timing';

interface WaterParticle {
  x: number;
  z: number;
  vx: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 150;
/** Per-60 Hz-frame motion factor the velocities were tuned with. */
const MOTION_DT = 0.016;
let particles: WaterParticle[] = [];

/** `dt` is the frame time in seconds; motion, ageing and spawning scale with it. */
export function drawWaterFlow(
  dc: DrawContext,
  W: Float64Array,
  b: Float64Array,
  H: Float64Array,
  xPositions: Float64Array,
  is_floating: Uint8Array,
  dt: number = REFERENCE_FRAME_S,
): void {
  const { ctx, xMax } = dc;
  const steps = frameSteps(dt);

  // Spawn particles where water pressure is high (per-frame chance scaled by frame length)
  for (let idx = 1; idx < W.length - 1 && particles.length < MAX_PARTICLES; idx++) {
    if (W[idx] > 0.1 && !is_floating[idx] && H[idx] > 50 && Math.random() < W[idx] * 0.3 * steps) {
      particles.push({
        x: xPositions[idx],
        z: b[idx] + 5, // Just above bedrock
        vx: 200 + Math.random() * 500, // Flow towards ocean
        life: 0,
        maxLife: 60 + Math.random() * 60,
      });
    }
  }

  const alive: WaterParticle[] = [];

  for (const p of particles) {
    p.x += p.vx * MOTION_DT * steps;
    p.life += steps;

    if (p.life > p.maxLife || p.x > xMax) continue;

    // Find bedrock at current x
    for (let i = 0; i < xPositions.length - 1; i++) {
      if (xPositions[i] <= p.x && xPositions[i + 1] > p.x) {
        const frac = (p.x - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
        p.z = b[i] * (1 - frac) + b[i + 1] * frac + 5;
        break;
      }
    }

    alive.push(p);

    // Draw glowing cyan particle
    const cx = toCanvasX(p.x, dc);
    const cy = toCanvasY(p.z, dc);
    const alpha = 1 - p.life / p.maxLife;

    // Glow
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(78, 205, 196, ${alpha * 0.3})`;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(78, 205, 196, ${alpha * 0.8})`;
    ctx.fill();
  }

  particles = alive;
}

export function resetWaterFlow(): void {
  particles = [];
}
