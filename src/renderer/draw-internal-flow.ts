/**
 * Internal ice flow visualization overlays:
 * - Strain rate heatmap
 * - Velocity profiles (vertical shear)
 * - Isochrone lines (deformation)
 * - Tracer particles (advection)
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';

// ─── Colormap Utility ──────────────────────────────────────────

/** 5-stop strain rate colormap: indigo → teal → green → yellow → red-orange */
const COLORMAP_STOPS: readonly [number, number, number, number][] = [
  [0.0, 26, 26, 94],     // deep indigo
  [0.25, 45, 106, 142],  // teal
  [0.5, 77, 166, 77],    // green
  [0.75, 232, 192, 32],  // warm yellow
  [1.0, 255, 58, 32],    // red-orange
];

/** Precomputed 256-entry lookup table for fast colormap access. */
const COLORMAP_LUT: string[] = buildColormapLUT();

function buildColormapLUT(): string[] {
  const lut: string[] = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    lut.push(colormapRGBA(t, 0.75));
  }
  return lut;
}

function colormapRGBA(t: number, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Find bounding stops
  let lo = 0;
  for (let i = 1; i < COLORMAP_STOPS.length; i++) {
    if (COLORMAP_STOPS[i][0] >= clamped) { lo = i - 1; break; }
  }
  const hi = Math.min(lo + 1, COLORMAP_STOPS.length - 1);
  const range = COLORMAP_STOPS[hi][0] - COLORMAP_STOPS[lo][0];
  const f = range > 0 ? (clamped - COLORMAP_STOPS[lo][0]) / range : 0;

  const r = Math.round(COLORMAP_STOPS[lo][1] + f * (COLORMAP_STOPS[hi][1] - COLORMAP_STOPS[lo][1]));
  const g = Math.round(COLORMAP_STOPS[lo][2] + f * (COLORMAP_STOPS[hi][2] - COLORMAP_STOPS[lo][2]));
  const b = Math.round(COLORMAP_STOPS[lo][3] + f * (COLORMAP_STOPS[hi][3] - COLORMAP_STOPS[lo][3]));
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Shared: clip to ice polygon ───────────────────────────────

function clipToIceBody(
  ctx: CanvasRenderingContext2D,
  dc: DrawContext,
  H: Float64Array,
  s: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
): boolean {
  const surfacePoints: [number, number][] = [];
  const basePoints: [number, number][] = [];

  for (let i = 0; i < H.length; i++) {
    if (H[i] < 5) continue;
    surfacePoints.push([toCanvasX(xPositions[i], dc), toCanvasY(s[i], dc)]);
    basePoints.push([toCanvasX(xPositions[i], dc), toCanvasY(ice_base[i], dc)]);
  }

  if (surfacePoints.length < 2) return false;

  ctx.beginPath();
  ctx.moveTo(surfacePoints[0][0], surfacePoints[0][1]);
  for (let i = 1; i < surfacePoints.length; i++) {
    ctx.lineTo(surfacePoints[i][0], surfacePoints[i][1]);
  }
  for (let i = basePoints.length - 1; i >= 0; i--) {
    ctx.lineTo(basePoints[i][0], basePoints[i][1]);
  }
  ctx.closePath();
  ctx.clip();
  return true;
}

// ─── 4A: Strain Rate Heatmap ──────────────────────────────────

const STRAIN_LOG_MIN = -4;  // log10(1e-4 yr^-1)
const STRAIN_LOG_MAX = -0.5; // log10(~0.3 yr^-1)
const EPS_MIN_SQ = 1e-20;   // regularization

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
  if (!clipToIceBody(ctx, dc, H, new Float64Array(H.length).map((_, i) => ice_base[i] + H[i]), ice_base, xPositions)) {
    ctx.restore();
    return;
  }

  // Subsample for performance: skip columns if grid is large
  const xStep = nx > 300 ? 2 : 1;
  const jStep = nz > 15 ? 2 : 1;

  for (let i = 1; i < nx - 1; i += xStep) {
    if (H[i] < 10) continue;

    const x0 = toCanvasX(xPositions[i], dc);
    const x1 = toCanvasX(xPositions[Math.min(i + xStep, nx - 1)], dc);

    for (let j = 0; j < nz - 1; j += jStep) {
      // Strain rate: du/dx and du/dz
      const dudx = (u_2d[(i + 1) * nz + j] - u_2d[(i - 1) * nz + j]) / (2 * dx);

      const jUp = Math.min(j + 1, nz - 1);
      const jDn = Math.max(j - 1, 0);
      const dudsigma = (u_2d[i * nz + jUp] - u_2d[i * nz + jDn]) / ((jUp - jDn) * dsigma);
      const dudz = dudsigma / Math.max(H[i], 1);

      const epsEff = Math.sqrt(dudx * dudx + 0.25 * dudz * dudz + EPS_MIN_SQ);
      const logEps = Math.log10(epsEff);

      // Map to [0, 1] for colormap
      const t = (logEps - STRAIN_LOG_MIN) / (STRAIN_LOG_MAX - STRAIN_LOG_MIN);
      const idx = Math.max(0, Math.min(255, Math.round(t * 255)));

      // Quad corners in physical space → canvas
      const sigma0 = j * dsigma;
      const sigma1 = Math.min((j + jStep) * dsigma, 1);
      const z0 = ice_base[i] + sigma0 * H[i];
      const z1 = ice_base[i] + sigma1 * H[i];

      const y0 = toCanvasY(z1, dc); // top (higher z → lower canvas y)
      const y1 = toCanvasY(z0, dc); // bottom

      ctx.fillStyle = COLORMAP_LUT[idx];
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // ── Color legend ──
  ctx.restore();
  ctx.save();
  const legendX = dc.width - 120;
  const legendY = dc.height - 100;
  const legendW = 12;
  const legendH = 70;

  for (let p = 0; p < legendH; p++) {
    const t = 1 - p / legendH;
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)));
    ctx.fillStyle = COLORMAP_LUT[idx];
    ctx.fillRect(legendX, legendY + p, legendW, 1);
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
  const sArr = new Float64Array(H.length);
  for (let i = 0; i < H.length; i++) sArr[i] = ice_base[i] + H[i];
  clipToIceBody(ctx, dc, H, sArr, ice_base, xPositions);

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

/** Reset tracer state (call on cleanup / scenario switch). */
export function resetTracerParticles(): void {
  tracers = [];
}

/** Display timestep per animation frame (years). */
const TRACER_DT = 2.0;

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
): void {
  const { ctx } = dc;
  const dx = xPositions[1] - xPositions[0];
  const domainMax = xPositions[nx - 1];

  // ── Spawn new particles at 4 source positions ──
  const spawnPerFrame = 4;
  const spawnPositions = [0.1, 0.3, 0.5, 0.7];

  for (let s = 0; s < spawnPerFrame && tracers.length < MAX_TRACERS; s++) {
    const frac = spawnPositions[s % spawnPositions.length];
    const idx = Math.floor(frac * (nx - 1));
    if (H[idx] < 20) continue;

    tracers.push({
      x: xPositions[idx],
      sigma: Math.random(),
      life: 0,
      maxLife: 200 + Math.random() * 300,
      prevX: xPositions[idx],
      prevSigma: Math.random(),
    });
  }

  // ── Advect particles ──
  const alive: TracerParticle[] = [];

  for (const p of tracers) {
    p.prevX = p.x;
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

    // Advect
    p.x += uLocal * TRACER_DT;
    p.life += 1;

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
