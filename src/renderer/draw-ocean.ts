/**
 * Draw ocean on the canvas.
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';

/**
 * Draw the ocean fill (sea level = 0).
 */
export function drawOcean(
  dc: DrawContext,
  b: Float64Array,
  xPositions: Float64Array,
  seaLevel: number = 0,
): void {
  const { ctx, width, height } = dc;
  const seaY = toCanvasY(seaLevel, dc);

  // Ocean gradient
  const gradient = ctx.createLinearGradient(0, seaY, 0, height);
  gradient.addColorStop(0, 'rgba(26, 58, 92, 0.85)');
  gradient.addColorStop(1, 'rgba(13, 33, 55, 0.95)');

  // Fill ocean where bedrock is below sea level
  ctx.beginPath();

  // Find where ocean starts (where b < seaLevel)
  let started = false;
  for (let i = 0; i < b.length; i++) {
    if (b[i] < seaLevel) {
      const cx = toCanvasX(xPositions[i], dc);
      if (!started) {
        ctx.moveTo(cx, seaY);
        started = true;
      }
    }
  }

  if (!started) return; // No ocean visible

  // Right edge at sea level
  ctx.lineTo(width, seaY);
  // Down to bottom right
  ctx.lineTo(width, height);
  // Along bottom to the start
  // Find leftmost ocean point
  for (let i = b.length - 1; i >= 0; i--) {
    if (b[i] < seaLevel && (i === 0 || b[i - 1] >= seaLevel)) {
      ctx.lineTo(toCanvasX(xPositions[i], dc), height);
      break;
    }
  }
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw sea surface line
  ctx.beginPath();
  let oceanStart = -1;
  for (let i = 0; i < b.length; i++) {
    if (b[i] < seaLevel) {
      if (oceanStart < 0) oceanStart = i;
    }
  }
  if (oceanStart >= 0) {
    ctx.moveTo(toCanvasX(xPositions[oceanStart], dc), seaY);
    ctx.lineTo(width, seaY);
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Subtle wave effect on sea surface
  ctx.beginPath();
  if (oceanStart >= 0) {
    const startX = toCanvasX(xPositions[oceanStart], dc);
    for (let px = startX; px < width; px += 3) {
      const waveY = seaY + Math.sin(px * 0.02 + Date.now() * 0.001) * 1.5;
      if (px === startX) ctx.moveTo(px, waveY);
      else ctx.lineTo(px, waveY);
    }
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
