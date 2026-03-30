/**
 * Draw ice sheet and ice shelf as one continuous body on the canvas.
 *
 * Following the reference marine-ice-sheet-flowline model:
 * the ice is rendered as a SINGLE polygon from surface to ice_base,
 * ensuring visual continuity across the grounding line.
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';

/**
 * Draw the unified ice body (grounded + floating as one continuous shape).
 */
export function drawIce(
  dc: DrawContext,
  H: Float64Array,
  s: Float64Array,
  ice_base: Float64Array,
  is_floating: Uint8Array,
  xPositions: Float64Array,
  gl_position_m: number,
): void {
  const { ctx } = dc;

  // Collect all points where ice exists (H > threshold)
  const surfacePoints: [number, number][] = [];
  const basePoints: [number, number][] = [];
  const floatingFlags: boolean[] = [];

  for (let i = 0; i < H.length; i++) {
    if (H[i] < 5) continue;

    const cx = toCanvasX(xPositions[i], dc);
    const topY = toCanvasY(s[i], dc);
    const botY = toCanvasY(ice_base[i], dc);

    surfacePoints.push([cx, topY]);
    basePoints.push([cx, botY]);
    floatingFlags.push(is_floating[i] === 1);
  }

  if (surfacePoints.length < 2) return;

  // ── Draw filled ice body (single continuous polygon) ──
  // Grounded section: opaque white-blue gradient
  // Floating section: translucent lighter blue

  // Find GL position on canvas for gradient split
  const glCanvasX = toCanvasX(gl_position_m, dc);

  // Create ice body gradient (top to bottom)
  const gradTop = toCanvasY(4000, dc);
  const gradBot = toCanvasY(-1200, dc);
  const iceGradient = ctx.createLinearGradient(0, gradTop, 0, gradBot);
  iceGradient.addColorStop(0, '#E8F4FD');
  iceGradient.addColorStop(0.25, '#C0DEF0');
  iceGradient.addColorStop(0.5, '#7FBDD5');
  iceGradient.addColorStop(0.75, '#4A9ABF');
  iceGradient.addColorStop(1, '#2E7BA5');

  // ── 1. Draw grounded ice (opaque) ──
  ctx.save();
  ctx.beginPath();
  // Clip to grounded region (left of GL)
  ctx.rect(0, 0, glCanvasX + 1, dc.height);
  ctx.clip();

  // Trace full ice polygon
  traceIcePolygon(ctx, surfacePoints, basePoints);
  ctx.fillStyle = iceGradient;
  ctx.fill();
  ctx.restore();

  // ── 2. Draw floating ice (semi-transparent) ──
  ctx.save();
  ctx.beginPath();
  // Clip to floating region (right of GL)
  ctx.rect(glCanvasX - 1, 0, dc.width - glCanvasX + 1, dc.height);
  ctx.clip();

  // Trace full ice polygon again
  traceIcePolygon(ctx, surfacePoints, basePoints);
  // Lighter, semi-transparent fill for shelf
  const shelfGradient = ctx.createLinearGradient(0, gradTop, 0, gradBot);
  shelfGradient.addColorStop(0, 'rgba(200, 225, 240, 0.7)');
  shelfGradient.addColorStop(0.3, 'rgba(160, 210, 235, 0.6)');
  shelfGradient.addColorStop(0.7, 'rgba(120, 185, 215, 0.5)');
  shelfGradient.addColorStop(1, 'rgba(80, 150, 195, 0.4)');
  ctx.fillStyle = shelfGradient;
  ctx.fill();
  ctx.restore();

  // ── 3. Surface line (continuous across GL) ──
  ctx.beginPath();
  ctx.moveTo(surfacePoints[0][0], surfacePoints[0][1]);
  for (let i = 1; i < surfacePoints.length; i++) {
    ctx.lineTo(surfacePoints[i][0], surfacePoints[i][1]);
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── 4. Shelf base line (dashed, only for floating section) ──
  let shelfStarted = false;
  ctx.beginPath();
  for (let i = 0; i < basePoints.length; i++) {
    if (floatingFlags[i]) {
      if (!shelfStarted) {
        ctx.moveTo(basePoints[i][0], basePoints[i][1]);
        shelfStarted = true;
      } else {
        ctx.lineTo(basePoints[i][0], basePoints[i][1]);
      }
    }
  }
  if (shelfStarted) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(110, 180, 210, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Trace the ice body as a single closed polygon.
 * Surface points left-to-right, then base points right-to-left.
 */
function traceIcePolygon(
  ctx: CanvasRenderingContext2D,
  surfacePoints: [number, number][],
  basePoints: [number, number][],
): void {
  ctx.beginPath();
  ctx.moveTo(surfacePoints[0][0], surfacePoints[0][1]);

  // Top edge: left to right
  for (let i = 1; i < surfacePoints.length; i++) {
    ctx.lineTo(surfacePoints[i][0], surfacePoints[i][1]);
  }

  // Bottom edge: right to left
  for (let i = basePoints.length - 1; i >= 0; i--) {
    ctx.lineTo(basePoints[i][0], basePoints[i][1]);
  }

  ctx.closePath();
}

/**
 * Draw the grounding line marker.
 */
export function drawGroundingLine(
  dc: DrawContext,
  gl_position_m: number,
  b: Float64Array,
  xPositions: Float64Array,
): void {
  const { ctx } = dc;

  // Find the bedrock elevation at GL
  let glBedrock = -500;
  for (let i = 0; i < xPositions.length - 1; i++) {
    if (xPositions[i] <= gl_position_m && xPositions[i + 1] > gl_position_m) {
      const frac = (gl_position_m - xPositions[i]) / (xPositions[i + 1] - xPositions[i]);
      glBedrock = b[i] * (1 - frac) + b[i + 1] * frac;
      break;
    }
  }

  const cx = toCanvasX(gl_position_m, dc);
  const cy = toCanvasY(glBedrock, dc);

  // Golden triangle marker
  const size = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx - size * 0.7, cy + size * 0.5);
  ctx.lineTo(cx + size * 0.7, cy + size * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pulsing glow
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
  ctx.beginPath();
  ctx.arc(cx, cy, 12 + pulse * 4, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + pulse * 0.3})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.font = '10px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.fillText('GL', cx, cy + size + 14);
}
