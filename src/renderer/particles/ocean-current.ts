/**
 * Warm ocean current particle system.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';

interface OceanParticle {
  x: number;
  z: number;
  vx: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 100;
let particles: OceanParticle[] = [];

export function drawOceanCurrent(
  dc: DrawContext,
  is_floating: Uint8Array,
  _b: Float64Array,
  H: Float64Array,
  xPositions: Float64Array,
  T_ocean_delta: number,
): void {
  const { ctx } = dc;

  if (T_ocean_delta <= 0) {
    // No warm current to display
    particles = [];
    return;
  }

  const intensity = Math.min(1, T_ocean_delta / 3);

  // Spawn from ocean side
  if (particles.length < MAX_PARTICLES * intensity) {
    const lastX = xPositions[xPositions.length - 1];
    particles.push({
      x: lastX + 100,
      z: -200 - Math.random() * 300,
      vx: -(100 + Math.random() * 200),
      life: 0,
      maxLife: 80 + Math.random() * 80,
    });
  }

  const alive: OceanParticle[] = [];

  for (const p of particles) {
    p.x += p.vx * 0.016;
    p.z += (Math.random() - 0.5) * 10;
    p.life++;

    if (p.life > p.maxLife) continue;

    // Check if reached grounded ice
    let underIce = false;
    for (let i = 0; i < xPositions.length; i++) {
      if (Math.abs(xPositions[i] - p.x) < xPositions[1] - xPositions[0]) {
        if (is_floating[i] && H[i] > 10) {
          underIce = true;
        }
        break;
      }
    }

    if (!underIce && p.x < xPositions[xPositions.length - 1] * 0.8) continue;

    alive.push(p);

    const cx = toCanvasX(p.x, dc);
    const cy = toCanvasY(p.z, dc);
    const alpha = (1 - p.life / p.maxLife) * intensity;

    // Warm color particle
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 107, 53, ${alpha * 0.5})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 68, 68, ${alpha * 0.8})`;
    ctx.fill();
  }

  particles = alive;
}

export function resetOceanCurrent(): void {
  particles = [];
}
