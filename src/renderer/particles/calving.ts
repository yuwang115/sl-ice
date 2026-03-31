/**
 * Iceberg calving particle system.
 *
 * Two-phase lifecycle:
 *   1. Detach — iceberg cracks away from the ice front, falls with gravity,
 *      rotates as it tips. Splash spawns when it hits the waterline.
 *   2. Drift  — iceberg floats at sea level, bobs gently, drifts rightward,
 *      slowly melts (shrinks), and fades out near end of life.
 */

import { toCanvasX, toCanvasY, type DrawContext } from '../draw-bedrock';

// ── Iceberg ────────────────────────────────────────────────────

interface IcebergVertex {
  dx: number; // offset from center (fraction of width, -0.5..0.5)
  dz: number; // offset from center (fraction of height, -0.5..0.5)
}

interface Iceberg {
  x: number;
  z: number;
  vx: number;
  vz: number;
  width: number;          // canvas px (shrinks with melt)
  height: number;         // canvas px
  rotation: number;
  rotSpeed: number;
  phase: 'detach' | 'drift';
  life: number;
  maxLife: number;
  bobPhase: number;
  bobAmp: number;
  driftSpeed: number;     // domain m per frame
  vertices: IcebergVertex[];
}

// ── Splash ─────────────────────────────────────────────────────

interface Splash {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

// ── State ──────────────────────────────────────────────────────

let icebergs: Iceberg[] = [];
let splashes: Splash[] = [];
const MAX_ICEBERGS = 60;

/** Generate an irregular 5-6 vertex polygon shape for an iceberg. */
function generateVertices(): IcebergVertex[] {
  const n = 5 + Math.floor(Math.random() * 2); // 5 or 6 vertices
  const verts: IcebergVertex[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 0.35 + Math.random() * 0.15;
    verts.push({
      dx: Math.cos(angle) * r,
      dz: Math.sin(angle) * r,
    });
  }
  return verts;
}

/**
 * Trigger a calving burst at the ice front.
 *
 * @param frontX  Domain x of the ice front (m)
 * @param frontZ  Domain z at the surface of the ice front (m)
 * @param count   Number of icebergs to spawn
 * @param large   If true, spawn larger icebergs (MICI cliff failure)
 */
export function triggerCalving(
  frontX: number,
  frontZ: number,
  count: number = 12,
  large: boolean = false,
): void {
  // Cap total icebergs
  const room = MAX_ICEBERGS - icebergs.length;
  const n = Math.min(count, room);

  for (let i = 0; i < n; i++) {
    const sizeBase = large ? 16 + Math.random() * 12 : 5 + Math.random() * 10;
    const aspectRatio = 0.6 + Math.random() * 0.6; // taller or wider

    icebergs.push({
      x: frontX + Math.random() * 3000,
      z: frontZ - Math.random() * 200,
      vx: 80 + Math.random() * 250,
      vz: 30 + Math.random() * 120,
      width: sizeBase,
      height: sizeBase * aspectRatio,
      rotation: (Math.random() - 0.5) * 0.3,
      rotSpeed: (Math.random() - 0.5) * 0.06,
      phase: 'detach',
      life: 0,
      maxLife: 300 + Math.random() * 350,
      bobPhase: Math.random() * Math.PI * 2,
      bobAmp: 1.5 + Math.random() * 2,
      driftSpeed: 60 + Math.random() * 120,
      vertices: generateVertices(),
    });
  }
}

// ── Update helpers ─────────────────────────────────────────────

const DT = 0.016; // ~60fps frame time
const GRAVITY = -600; // domain m/s² (visual, not physical)

function spawnSplash(berg: Iceberg): void {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    splashes.push({
      x: berg.x + (Math.random() - 0.5) * 1500,
      z: 10 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 150,
      vz: 80 + Math.random() * 160,
      life: 0,
      maxLife: 18 + Math.random() * 14,
      size: 1.5 + Math.random() * 2,
    });
  }
}

// ── Draw ───────────────────────────────────────────────────────

function drawIcebergShape(
  ctx: CanvasRenderingContext2D,
  berg: Iceberg,
  cx: number,
  cy: number,
  scale: number,
  alpha: number,
  aboveWater: boolean,
): void {
  const w = berg.width * scale;
  const h = berg.height * scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(berg.rotation);

  // Trace irregular polygon
  ctx.beginPath();
  const v0 = berg.vertices[0];
  ctx.moveTo(v0.dx * w, v0.dz * h);
  for (let i = 1; i < berg.vertices.length; i++) {
    const v = berg.vertices[i];
    ctx.lineTo(v.dx * w, v.dz * h);
  }
  ctx.closePath();

  if (aboveWater) {
    // Bright white-blue
    ctx.fillStyle = `rgba(210, 235, 250, ${alpha * 0.85})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    // Darker underwater portion
    ctx.fillStyle = `rgba(100, 170, 210, ${alpha * 0.35})`;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Update and draw all icebergs and splashes.
 */
export function drawCalving(dc: DrawContext): void {
  const { ctx } = dc;
  const seaY = toCanvasY(0, dc);

  // ── Update icebergs ──
  const aliveIcebergs: Iceberg[] = [];

  for (const berg of icebergs) {
    berg.life++;

    if (berg.phase === 'detach') {
      // Falling phase: gravity + drift
      berg.x += berg.vx * DT;
      berg.vz += GRAVITY * DT;
      berg.z += berg.vz * DT;
      berg.rotation += berg.rotSpeed;

      // Transition to drift when hitting sea level
      if (berg.z <= 0) {
        berg.z = 0;
        berg.vz = 0;
        berg.phase = 'drift';
        // Dampen rotation for floating stability
        berg.rotSpeed *= 0.15;
        spawnSplash(berg);
      }
    } else {
      // Drift phase: float at sea level with bobbing
      berg.x += berg.driftSpeed * DT;
      berg.z = Math.sin(Date.now() * 0.003 + berg.bobPhase) * berg.bobAmp;

      // Gentle rotation wobble
      berg.rotation += berg.rotSpeed;
      berg.rotSpeed *= 0.995; // slow damping
      berg.rotSpeed += Math.sin(Date.now() * 0.002 + berg.bobPhase) * 0.0005;

      // Melt: shrink over time (faster in second half of life)
      const lifeFrac = berg.life / berg.maxLife;
      const meltFactor = lifeFrac > 0.5 ? 0.997 : 0.999;
      berg.width *= meltFactor;
      berg.height *= meltFactor;
    }

    // Cull if too old, too small, or drifted off-screen
    const cx = toCanvasX(berg.x, dc);
    if (berg.life > berg.maxLife || berg.width < 1.5 || cx > dc.width + 50) {
      continue;
    }

    aliveIcebergs.push(berg);
  }

  icebergs = aliveIcebergs;

  // ── Update splashes ──
  const aliveSplashes: Splash[] = [];

  for (const sp of splashes) {
    sp.x += sp.vx * DT;
    sp.vz -= 400 * DT; // gravity on spray
    sp.z += sp.vz * DT;
    sp.life++;

    if (sp.life > sp.maxLife || sp.z < -50) continue;
    aliveSplashes.push(sp);
  }

  splashes = aliveSplashes;

  // ── Draw underwater portions first (behind ocean surface) ──
  for (const berg of icebergs) {
    if (berg.phase !== 'drift') continue;

    const cx = toCanvasX(berg.x, dc);
    // Position the underwater center below sea level
    const underwaterCy = seaY + berg.height * 0.4;
    const lifeFrac = berg.life / berg.maxLife;
    const alpha = lifeFrac > 0.7 ? 1 - (lifeFrac - 0.7) / 0.3 : 1;

    drawIcebergShape(ctx, berg, cx, underwaterCy, 0.9, alpha, false);
  }

  // ── Draw above-water portions + detaching icebergs ──
  for (const berg of icebergs) {
    const cx = toCanvasX(berg.x, dc);
    const lifeFrac = berg.life / berg.maxLife;
    const alpha = lifeFrac > 0.7 ? 1 - (lifeFrac - 0.7) / 0.3 : 1;

    if (berg.phase === 'detach') {
      // Falling iceberg: draw at actual position
      const cy = toCanvasY(berg.z, dc);
      drawIcebergShape(ctx, berg, cx, cy, 1, alpha, true);
    } else {
      // Floating: draw above-water portion at sea level
      const aboveCy = seaY - berg.height * 0.15;
      drawIcebergShape(ctx, berg, cx, aboveCy, 0.7, alpha, true);
    }
  }

  // ── Draw splashes ──
  for (const sp of splashes) {
    const cx = toCanvasX(sp.x, dc);
    const cy = toCanvasY(sp.z, dc);
    const alpha = 1 - sp.life / sp.maxLife;

    ctx.beginPath();
    ctx.arc(cx, cy, sp.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 240, 255, ${alpha * 0.9})`;
    ctx.fill();
  }
}

export function resetCalving(): void {
  icebergs = [];
  splashes = [];
}
