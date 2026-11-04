/**
 * Internal ice flow visualization overlays:
 * - Strain rate heatmap
 * - Velocity profiles (vertical shear)
 * - Isochrone lines (deformation)
 * - Tracer particles (advection)
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';
import { createSpawnBudget, frameSteps, REFERENCE_FRAME_S } from './frame-timing';
import {
  rasterizeStrainField,
  STRAIN_COLOR_LUT,
  STRAIN_MIN_THICKNESS,
  strainColumnStep,
  type StrainRaster,
} from './strain-raster';

// ─── Shared: clip to ice polygon ───────────────────────────────

/**
 * Clip to the ice body: top edge at ice_base + H, bottom edge at ice_base,
 * over nodes with at least 5 m of ice. Traced directly (no point arrays).
 */
function clipToIceBody(
  ctx: CanvasRenderingContext2D,
  dc: DrawContext,
  H: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
): boolean {
  let count = 0;
  ctx.beginPath();
  for (let i = 0; i < H.length; i++) {
    if (H[i] < 5) continue;
    const x = toCanvasX(xPositions[i], dc);
    const y = toCanvasY(ice_base[i] + H[i], dc);
    if (count === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    count++;
  }
  if (count < 2) return false;

  for (let i = H.length - 1; i >= 0; i--) {
    if (H[i] < 5) continue;
    ctx.lineTo(toCanvasX(xPositions[i], dc), toCanvasY(ice_base[i], dc));
  }
  ctx.closePath();
  ctx.clip();
  return true;
}

// ─── 4A: Strain Rate Heatmap ──────────────────────────────────

/** Reused raster + 1-texel-per-column upload canvas (sizes are fixed per scenario). */
interface StrainSurface {
  raster: StrainRaster;
  image: ImageData;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

let strainSurface: StrainSurface | null = null;
let legendCanvas: HTMLCanvasElement | null = null;

const LEGEND_W = 12;
const LEGEND_H = 70;

/** Rasterise the field and upload it into a small canvas; null if canvases are unavailable. */
function uploadStrainField(
  u_2d: Float64Array, H: Float64Array, dx: number, nx: number, nz: number, dsigma: number,
): StrainSurface | null {
  const raster = rasterizeStrainField({ u2d: u_2d, H, dx, nx, nz, dsigma }, strainSurface?.raster);
  if (raster.cols === 0 || raster.rows === 0) return null;

  if (!strainSurface || strainSurface.raster !== raster) {
    const canvas = strainSurface?.canvas ?? document.createElement('canvas');
    canvas.width = raster.cols;
    canvas.height = raster.rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    strainSurface = { raster, image: new ImageData(raster.data, raster.cols, raster.rows), canvas, ctx };
  }
  strainSurface.ctx.putImageData(strainSurface.image, 0, 0);
  return strainSurface;
}

/** One 1-px column per LUT step, built once. */
function getLegendCanvas(): HTMLCanvasElement | null {
  if (legendCanvas) return legendCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = LEGEND_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(1, LEGEND_H);
  for (let p = 0; p < LEGEND_H; p++) {
    const idx = Math.max(0, Math.min(255, Math.round((1 - p / LEGEND_H) * 255)));
    image.data.set(STRAIN_COLOR_LUT.subarray(idx * 4, idx * 4 + 4), p * 4);
  }
  ctx.putImageData(image, 0, 0);
  legendCanvas = canvas;
  return canvas;
}

export function drawStrainRateHeatmap(
  dc: DrawContext,
  u_2d: Float64Array,
  H: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
  nx: number,
  nz: number,
  dsigma: number,
): void {
  const { ctx } = dc;
  const dx = xPositions[1] - xPositions[0];

  ctx.save();
  if (!clipToIceBody(ctx, dc, H, ice_base, xPositions)) {
    ctx.restore();
    return;
  }

  const surface = uploadStrainField(u_2d, H, dx, nx, nz, dsigma);
  if (surface) {
    const { raster, canvas } = surface;
    const xStep = strainColumnStep(nx);
    const sigmaTop = Math.min(1, raster.rows * dsigma);
    ctx.imageSmoothingEnabled = false;

    // Stretch each column strip over its ice column (sigma 0 → 1).
    for (let c = 0; c < raster.cols; c++) {
      const i = raster.nodeIndex[c];
      if (H[i] < STRAIN_MIN_THICKNESS) continue;
      const x0 = toCanvasX(xPositions[i], dc);
      const x1 = toCanvasX(xPositions[Math.min(i + xStep, nx - 1)], dc);
      const yTop = toCanvasY(ice_base[i] + sigmaTop * H[i], dc);
      const yBottom = toCanvasY(ice_base[i], dc);
      ctx.drawImage(canvas, c, 0, 1, raster.rows, x0, yTop, x1 - x0, yBottom - yTop);
    }
  }

  // ── Color legend ──
  ctx.restore();
  ctx.save();
  const legendX = dc.width - 120;
  const legendY = dc.height - 100;
  const legendW = LEGEND_W;
  const legendH = LEGEND_H;

  const legend = getLegendCanvas();
  if (legend) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(legend, legendX, legendY, legendW, legendH);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(legendX, legendY, legendW, legendH);

  ctx.font = '8px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'left';
  ctx.fillText('high', legendX + legendW + 4, legendY + 7);
  ctx.fillText('low', legendX + legendW + 4, legendY + legendH);
  ctx.fillText('strain', legendX - 2, legendY - 4);

  ctx.restore();
}

// ─── 4B: Velocity Profiles (Vertical Shear) ──────────────────

export function drawVelocityProfiles(
  dc: DrawContext,
  u_2d: Float64Array,
  H: Float64Array,
  s: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
  nx: number,
  nz: number,
  dsigma: number,
): void {
  const { ctx } = dc;

  // Pick ~6 evenly spaced positions with substantial ice
  const candidates: number[] = [];
  for (let i = Math.floor(nx * 0.05); i < nx * 0.95; i++) {
    if (H[i] > 50) candidates.push(i);
  }
  if (candidates.length === 0) return;

  const numProfiles = Math.min(6, candidates.length);
  const step = Math.floor(candidates.length / numProfiles);
  const selected: number[] = [];
  for (let k = 0; k < numProfiles; k++) {
    selected.push(candidates[k * step]);
  }

  // Find global max velocity for scaling
  let uMax = 1;
  for (let k = 0; k < selected.length; k++) {
    const i = selected[k];
    for (let j = 0; j < nz; j++) {
      const v = Math.abs(u_2d[i * nz + j]);
      if (v > uMax) uMax = v;
    }
  }

  const maxBarPx = 35;

  for (const i of selected) {
    const cx = toCanvasX(xPositions[i], dc);
    const cyTop = toCanvasY(s[i], dc);
    const cyBot = toCanvasY(ice_base[i], dc);

    // Vertical reference line
    ctx.beginPath();
    ctx.moveTo(cx, cyTop);
    ctx.lineTo(cx, cyBot);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Profile curve: collect points
    const profilePoints: [number, number][] = [];
    for (let j = 0; j < nz; j++) {
      const sigma = j * dsigma;
      const z = ice_base[i] + sigma * H[i];
      const cy = toCanvasY(z, dc);
      const vel = u_2d[i * nz + j];
      const barLen = (vel / uMax) * maxBarPx;
      profilePoints.push([cx + barLen, cy]);
    }

    // Draw glow (wide, low opacity)
    ctx.beginPath();
    ctx.moveTo(profilePoints[0][0], profilePoints[0][1]);
    for (let p = 1; p < profilePoints.length; p++) {
      ctx.lineTo(profilePoints[p][0], profilePoints[p][1]);
    }
    ctx.strokeStyle = 'rgba(100,200,255,0.2)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Draw profile curve (thin, bright)
    ctx.beginPath();
    ctx.moveTo(profilePoints[0][0], profilePoints[0][1]);
    for (let p = 1; p < profilePoints.length; p++) {
      ctx.lineTo(profilePoints[p][0], profilePoints[p][1]);
    }
    ctx.strokeStyle = 'rgba(120,220,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Horizontal ticks at a few sigma levels
    for (let j = 0; j < nz; j += Math.max(1, Math.floor(nz / 5))) {
      const [px, py] = profilePoints[j];
      ctx.beginPath();
      ctx.moveTo(cx, py);
      ctx.lineTo(px, py);
      ctx.strokeStyle = 'rgba(200,230,255,0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Velocity label at surface
    const surfVel = u_2d[i * nz + (nz - 1)];
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(120,220,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(surfVel)} m/yr`, cx + maxBarPx + 4, cyTop + 3);
  }
}

// ─── 4C: Isochrone Lines ──────────────────────────────────────

const DISPLAY_TIMESCALE = 60; // years — tuned for visual clarity

export function drawIsochrones(
  dc: DrawContext,
  u_2d: Float64Array,
  H: Float64Array,
  _s: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
  nx: number,
  nz: number,
  dsigma: number,
): void {
  const { ctx } = dc;
  const domainWidth = xPositions[nx - 1] - xPositions[0];
  const pxPerM = dc.width / domainWidth;

  // Place ~10 isochrone lines where ice exists
  const iceIndices: number[] = [];
  for (let i = Math.floor(nx * 0.05); i < nx * 0.9; i++) {
    if (H[i] > 50) iceIndices.push(i);
  }
  if (iceIndices.length < 5) return;

  const numLines = Math.min(10, iceIndices.length);
  const lineStep = Math.floor(iceIndices.length / numLines);

  ctx.save();
  // Clip to ice body
  clipToIceBody(ctx, dc, H, ice_base, xPositions);

  for (let k = 0; k < numLines; k++) {
    const i = iceIndices[k * lineStep];
    const basalVel = u_2d[i * nz + 0];
    const cx0 = toCanvasX(xPositions[i], dc);

    // Build deformed line points
    const points: [number, number][] = [];
    for (let j = 0; j < nz; j++) {
      const sigma = j * dsigma;
      const z = ice_base[i] + sigma * H[i];
      const cy = toCanvasY(z, dc);

      // Offset = differential velocity relative to bed × timescale
      const vel = u_2d[i * nz + j];
      const xOffsetM = (vel - basalVel) * DISPLAY_TIMESCALE;
      const xOffsetPx = xOffsetM * pxPerM;

      points.push([cx0 + xOffsetPx, cy]);
    }

    // Draw the deformed isochrone
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let p = 1; p < points.length; p++) {
      ctx.lineTo(points[p][0], points[p][1]);
    }
    ctx.strokeStyle = 'rgba(180,140,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small arrow at surface to show flow direction
    const top = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(top[0] - 4, top[1] - 3);
    ctx.moveTo(top[0], top[1]);
    ctx.lineTo(top[0] - 4, top[1] + 3);
    ctx.strokeStyle = 'rgba(180,140,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// ─── 4D: Tracer Particles ─────────────────────────────────────

interface TracerParticle {
  x: number;     // domain x (m)
  sigma: number;  // vertical position [0, 1]
  life: number;
  maxLife: number;
  // For tail drawing
  prevX: number;
  prevSigma: number;
}

const MAX_TRACERS = 300;
let tracers: TracerParticle[] = [];
const tracerSpawns = createSpawnBudget();
let tracerSpawnCursor = 0;

/** Reset tracer state (call on cleanup / scenario switch). */
export function resetTracerParticles(): void {
  tracers = [];
  tracerSpawns.clear();
  tracerSpawnCursor = 0;
}

/** Display timestep per 60 Hz animation frame (years). */
const TRACER_DT = 2.0;
/** Spawn attempts per 60 Hz frame, cycling through the source positions. */
const TRACER_SPAWNS_PER_FRAME = 4;
const TRACER_SPAWN_POSITIONS = [0.1, 0.3, 0.5, 0.7] as const;

function spawnTracers(H: Float64Array, xPositions: Float64Array, nx: number, steps: number): void {
  const due = tracerSpawns.take(TRACER_SPAWNS_PER_FRAME, steps);
  for (let n = 0; n < due && tracers.length < MAX_TRACERS; n++) {
    const frac = TRACER_SPAWN_POSITIONS[tracerSpawnCursor++ % TRACER_SPAWN_POSITIONS.length];
    const idx = Math.floor(frac * (nx - 1));
    if (H[idx] < 20) continue;

    const sigma = Math.random();
    tracers.push({
      x: xPositions[idx],
      sigma,
      life: 0,
      maxLife: 200 + Math.random() * 300,
      prevX: xPositions[idx],
      prevSigma: sigma,
    });
  }
  if (tracers.length >= MAX_TRACERS) tracerSpawns.clear();
}

export function drawTracerParticles(
  dc: DrawContext,
  u_2d: Float64Array,
  H: Float64Array,
  _s: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
  nx: number,
  nz: number,
  dsigma: number,
  dt: number = REFERENCE_FRAME_S,
): void {
  const { ctx } = dc;
  const dx = xPositions[1] - xPositions[0];
  const domainMax = xPositions[nx - 1];
  const steps = frameSteps(dt);

  // ── Spawn new particles at 4 source positions ──
  spawnTracers(H, xPositions, nx, steps);

  // ── Advect particles ──
  const alive: TracerParticle[] = [];

  for (const p of tracers) {
    p.prevSigma = p.sigma;

    // Find grid cell
    const fi = p.x / dx;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fi)));
    const fx = fi - i;

    const fj = p.sigma / dsigma;
    const j = Math.max(0, Math.min(nz - 2, Math.floor(fj)));
    const fy = fj - j;

    // Bilinear interpolation of velocity
    const u00 = u_2d[i * nz + j];
    const u10 = u_2d[(i + 1) * nz + j];
    const u01 = u_2d[i * nz + j + 1];
    const u11 = u_2d[(i + 1) * nz + j + 1];
    const uLocal = u00 * (1 - fx) * (1 - fy) + u10 * fx * (1 - fy) +
                   u01 * (1 - fx) * fy + u11 * fx * fy;

    // Advect; the tail always spans one 60 Hz step so its length is refresh-rate independent
    p.x += uLocal * TRACER_DT * steps;
    p.prevX = p.x - uLocal * TRACER_DT;
    p.life += steps;

    // Check if still in domain
    const iNew = Math.floor(p.x / dx);
    if (p.x < 0 || p.x > domainMax || iNew < 0 || iNew >= nx || H[iNew] < 5 || p.life > p.maxLife) {
      continue; // remove particle
    }

    alive.push(p);
  }

  tracers = alive;

  // ── Draw particles ──
  for (const p of tracers) {
    // Find physical z at current position
    const i = Math.max(0, Math.min(nx - 1, Math.floor(p.x / dx)));
    const z = ice_base[i] + p.sigma * H[i];
    const cx = toCanvasX(p.x, dc);
    const cy = toCanvasY(z, dc);

    // Previous position for tail
    const iPrev = Math.max(0, Math.min(nx - 1, Math.floor(p.prevX / dx)));
    const zPrev = ice_base[iPrev] + p.prevSigma * H[iPrev];
    const cxPrev = toCanvasX(p.prevX, dc);
    const cyPrev = toCanvasY(zPrev, dc);

    // Color by depth: surface (sigma=1) = bright white, bed (sigma=0) = dark blue
    const brightness = 0.3 + 0.7 * p.sigma;
    const r = Math.round(40 + 215 * p.sigma);
    const g = Math.round(100 + 155 * p.sigma);
    const b = Math.round(180 + 75 * p.sigma);
    const alpha = brightness * Math.min(1, p.life / 20); // fade in

    // Tail
    ctx.beginPath();
    ctx.moveTo(cxPrev, cyPrev);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }
}
