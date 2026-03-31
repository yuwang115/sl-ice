/**
 * Draw annotations, labels, and info bubbles on the canvas.
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';

/**
 * Draw axis labels and scale indicators.
 */
export function drawAxes(dc: DrawContext): void {
  const { ctx, width, height, xMax, zMin, zMax } = dc;

  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(224, 224, 224, 0.6)';
  ctx.textAlign = 'center';

  // X axis labels (distance in km)
  const xStepKm = 100;
  const xStepM = xStepKm * 1000;
  for (let x = 0; x <= xMax; x += xStepM) {
    const cx = toCanvasX(x, dc);
    if (cx < 30 || cx > width - 10) continue;
    ctx.fillText(`${x / 1000} km`, cx, height - 5);

    // Tick mark
    ctx.beginPath();
    ctx.moveTo(cx, height - 18);
    ctx.lineTo(cx, height - 15);
    ctx.strokeStyle = 'rgba(224, 224, 224, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Z axis labels (elevation in m)
  ctx.textAlign = 'right';
  const zStep = 500;
  for (let z = Math.ceil(zMin / zStep) * zStep; z <= zMax; z += zStep) {
    const cy = toCanvasY(z, dc);
    if (cy < 15 || cy > height - 20) continue;
    ctx.fillText(`${z}m`, 35, cy + 3);

    // Grid line
    ctx.beginPath();
    ctx.moveTo(38, cy);
    ctx.lineTo(width, cy);
    ctx.strokeStyle = 'rgba(224, 224, 224, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Sea level line
  const seaY = toCanvasY(0, dc);
  ctx.beginPath();
  ctx.moveTo(0, seaY);
  ctx.lineTo(width, seaY);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
  ctx.textAlign = 'left';
  ctx.fillText('sea level', 40, seaY - 4);
}

/**
 * Draw a MISI warning overlay when MISI is active.
 */
export function drawMISIWarning(dc: DrawContext): void {
  const { ctx, width, height } = dc;

  // Red pulsing border
  const pulse = 0.3 + 0.3 * Math.sin(Date.now() * 0.004);
  ctx.strokeStyle = `rgba(255, 68, 68, ${pulse})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Warning text
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = `rgba(255, 68, 68, ${0.6 + pulse})`;
  ctx.textAlign = 'center';
  ctx.fillText('⚠ MARINE ICE SHEET INSTABILITY ⚠', width / 2, 25);
}

/**
 * Draw a MICI warning overlay when MICI is active.
 */
export function drawMICIWarning(dc: DrawContext): void {
  const { ctx, width, height } = dc;

  // Orange pulsing border (different frequency from MISI red)
  const pulse = 0.3 + 0.3 * Math.sin(Date.now() * 0.006);
  ctx.strokeStyle = `rgba(255, 140, 0, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Warning text
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = `rgba(255, 140, 0, ${0.5 + pulse})`;
  ctx.textAlign = 'center';
  ctx.fillText('\u26a0 MARINE ICE CLIFF INSTABILITY \u26a0', width / 2, 42);
}

/**
 * Draw cliff height indicator at the calving front.
 */
export function drawCliffIndicator(
  dc: DrawContext,
  cliffHeight: number,
  calvingRate: number,
  H: Float64Array,
  s: Float64Array,
  ice_base: Float64Array,
  xPositions: Float64Array,
): void {
  const { ctx } = dc;

  // Find the calving front (last node with substantial ice)
  let frontIndex = -1;
  for (let i = H.length - 1; i >= 0; i--) {
    if (H[i] >= 50) {
      frontIndex = i;
      break;
    }
  }
  if (frontIndex < 0) return;

  const cx = toCanvasX(xPositions[frontIndex], dc);
  const cyTop = toCanvasY(s[frontIndex], dc);
  const cyBase = toCanvasY(ice_base[frontIndex], dc);
  const cySeaLevel = toCanvasY(0, dc);

  // Color intensity based on calving rate (0 → orange, 500+ → red)
  const intensity = Math.min(1, calvingRate / 500);
  const r = 255;
  const g = Math.round(140 * (1 - intensity));
  const b = 0;

  // Draw cliff face line (vertical at calving front)
  ctx.beginPath();
  ctx.moveTo(cx, cyTop);
  ctx.lineTo(cx, cyBase);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw freeboard bracket (surface to sea level)
  const bracketX = cx + 8;
  ctx.beginPath();
  ctx.moveTo(bracketX - 4, cyTop);
  ctx.lineTo(bracketX, cyTop);
  ctx.lineTo(bracketX, cySeaLevel);
  ctx.lineTo(bracketX - 4, cySeaLevel);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Label: freeboard height
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
  ctx.textAlign = 'left';
  const midY = (cyTop + cySeaLevel) / 2;
  ctx.fillText(`${cliffHeight.toFixed(0)}m`, bracketX + 5, midY + 3);

  // Calving rate label
  if (calvingRate > 0) {
    ctx.font = '9px monospace';
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
    ctx.fillText(`${calvingRate.toFixed(0)} m/yr`, bracketX + 5, midY + 15);
  }
}

/**
 * Draw velocity arrows on the ice surface.
 */
export function drawVelocityArrows(
  dc: DrawContext,
  u_surface: Float64Array,
  s: Float64Array,
  H: Float64Array,
  xPositions: Float64Array,
  maxVel: number = 1000,
): void {
  const { ctx } = dc;

  const step = Math.max(1, Math.floor(u_surface.length / 15));
  const arrowScale = 25;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;

  for (let i = step; i < u_surface.length; i += step) {
    if (H[i] < 50) continue;

    const cx = toCanvasX(xPositions[i], dc);
    const cy = toCanvasY(s[i], dc) - 8; // Slightly above surface

    const vel = Math.min(u_surface[i], maxVel);
    const len = (vel / maxVel) * arrowScale;

    if (len < 2) continue;

    // Arrow body
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + len, cy);
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(cx + len, cy);
    ctx.lineTo(cx + len - 4, cy - 3);
    ctx.lineTo(cx + len - 4, cy + 3);
    ctx.closePath();
    ctx.fill();
  }
}
