/**
 * Iceberg calving particle effect.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';

interface CalvingParticle {
  x: number;
  z: number;
  vx: number;
  vz: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
}

let particles: CalvingParticle[] = [];

/**
 * Trigger a calving burst at the ice front.
 */
export function triggerCalving(
  frontX: number,
  frontZ: number,
  count: number = 15,
): void {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: frontX + Math.random() * 2000,
      z: frontZ + (Math.random() - 0.3) * 200,
      vx: 50 + Math.random() * 200,
      vz: (Math.random() - 0.5) * 150,
      size: 3 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      life: 0,
      maxLife: 60 + Math.random() * 90,
    });
  }
}

/**
 * Update and draw calving particles.
 */
export function drawCalving(dc: DrawContext): void {
  const { ctx } = dc;

  const alive: CalvingParticle[] = [];

  for (const p of particles) {
    p.x += p.vx * 0.016;
    p.z += p.vz * 0.016;
    p.vz -= 3; // Gravity
    p.rotation += p.rotSpeed;
    p.life++;

    if (p.life > p.maxLife) continue;
    alive.push(p);

    const cx = toCanvasX(p.x, dc);
    const cy = toCanvasY(p.z, dc);
    const alpha = 1 - p.life / p.maxLife;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.rotation);

    // Ice chunk (irregular rectangle)
    ctx.fillStyle = `rgba(200, 230, 245, ${alpha * 0.8})`;
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);

    ctx.restore();
  }

  particles = alive;
}

export function resetCalving(): void {
  particles = [];
}
