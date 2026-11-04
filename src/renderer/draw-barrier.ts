/**
 * Geoengineering seafloor barrier (curtain) marker.
 */

import type { UserParams } from '../engine/types';
import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';

/** Fraction of the water column the drawn curtain spans, from the seafloor up. */
const CURTAIN_HEIGHT_FRACTION = 0.5;

export interface BarrierGeometry {
  /** Along-flow position (m). */
  readonly x: number;
  /** Seafloor elevation at the barrier (m, negative below sea level). */
  readonly bed: number;
  /** Elevation of the curtain top (m). */
  readonly top: number;
}

/**
 * Where to draw the barrier, or null when there is none or it would stand
 * on dry land (bed at or above sea level) or outside the profile.
 */
export function barrierGeometry(
  curtainPositionKm: number | undefined,
  b: Float64Array,
  xPositions: Float64Array,
): BarrierGeometry | null {
  const n = Math.min(b.length, xPositions.length);
  if (curtainPositionKm == null || !Number.isFinite(curtainPositionKm) || n < 2) return null;
  const x = curtainPositionKm * 1000;
  if (x < xPositions[0] || x > xPositions[n - 1]) return null;

  let bed = b[n - 1];
  for (let i = 0; i < n - 1; i++) {
    if (x <= xPositions[i + 1]) {
      const span = xPositions[i + 1] - xPositions[i];
      const frac = span > 0 ? (x - xPositions[i]) / span : 0;
      bed = b[i] * (1 - frac) + b[i + 1] * frac;
      break;
    }
  }
  if (!(bed < 0)) return null;
  return { x, bed, top: bed * (1 - CURTAIN_HEIGHT_FRACTION) };
}

/** Draw the curtain as a post on the seafloor; opacity follows its efficiency. */
export function drawSeafloorBarrier(
  dc: DrawContext,
  params: UserParams,
  b: Float64Array,
  xPositions: Float64Array,
  language: 'en' | 'zh',
): void {
  const geometry = barrierGeometry(params.curtain_position, b, xPositions);
  if (!geometry) return;

  const { ctx } = dc;
  const efficiency = Math.max(0, Math.min(1, params.curtain_efficiency ?? 0));
  const cx = toCanvasX(geometry.x, dc);
  const yBed = toCanvasY(geometry.bed, dc);
  const yTop = toCanvasY(geometry.top, dc);

  ctx.save();
  ctx.fillStyle = `rgba(212, 133, 58, ${0.25 + 0.6 * efficiency})`;
  ctx.fillRect(cx - 2, yTop, 4, yBed - yTop);
  ctx.beginPath();
  ctx.arc(cx, yTop, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(232, 168, 96, 0.9)';
  ctx.textAlign = 'center';
  const label = language === 'zh' ? '屏障' : 'barrier';
  ctx.fillText(`${label} ${(efficiency * 100).toFixed(0)}%`, cx, yTop - 7);
  ctx.restore();
}
