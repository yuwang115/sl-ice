/**
 * Draw annotations, labels, and info bubbles on the canvas.
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';
import { drawTooltipPanel } from './canvas-text';

type Language = 'en' | 'zh';

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
export function drawMISIWarning(dc: DrawContext, language: Language = 'en'): void {
  const { ctx, width, height } = dc;

  // Red pulsing border
  const pulse = 0.3 + 0.3 * Math.sin(Date.now() * 0.004);
  ctx.strokeStyle = `rgba(255, 68, 68, ${pulse})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // Multiline warning panel
  const panelW = Math.min(360, width - 20);
  const title = language === 'zh'
    ? '\u26a0 \u6d77\u6d0b\u51b0\u76d6\u4e0d\u7a33\u5b9a\u6027'
    : '\u26a0 MARINE ICE SHEET INSTABILITY';
  const body = language === 'zh'
    ? '\u63a5\u5730\u7ebf\u6b63\u5728\u5411\u5185\u9646\u5feb\u901f\u540e\u9000\u3002\u6b63\u53cd\u9988\u53ef\u80fd\u5bfc\u81f4\u4e0d\u53ef\u9006\u7684\u51b0\u76d6\u5d29\u584c\u3002'
    : 'The grounding line is retreating rapidly inland. Positive feedback may cause irreversible collapse.';

  drawTooltipPanel(ctx, {
    x: width / 2 - panelW / 2,
    y: 8,
    maxWidth: panelW,
    padding: 8,
    bgColor: `rgba(60, 10, 10, ${0.85 + pulse * 0.1})`,
    borderColor: `rgba(255, 68, 68, ${0.5 + pulse * 0.3})`,
    borderRadius: 6,
    borderWidth: 2,
    titleFont: 'bold 13px "Nunito", sans-serif',
    titleColor: `rgba(255, 100, 100, ${0.8 + pulse * 0.2})`,
    title,
    bodyFont: '11px "Nunito", sans-serif',
    bodyColor: 'rgba(255, 200, 200, 0.85)',
    body,
    lineHeight: 15,
  });
}

/**
 * Draw a MICI warning overlay when MICI is active.
 */
export function drawMICIWarning(dc: DrawContext, language: Language = 'en'): void {
  const { ctx, width, height } = dc;

  // Orange pulsing border (different frequency from MISI red)
  const pulse = 0.3 + 0.3 * Math.sin(Date.now() * 0.006);
  ctx.strokeStyle = `rgba(255, 140, 0, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Multiline warning panel (offset below MISI panel if both active)
  const panelW = Math.min(340, width - 20);
  const title = language === 'zh'
    ? '\u26a0 \u6d77\u6d0b\u51b0\u5d16\u4e0d\u7a33\u5b9a\u6027'
    : '\u26a0 MARINE ICE CLIFF INSTABILITY';
  const body = language === 'zh'
    ? '\u51b0\u5d16\u8d85\u8fc7\u4e34\u754c\u9ad8\u5ea6\uff0c\u53ef\u80fd\u5728\u81ea\u8eab\u91cd\u91cf\u4e0b\u5d29\u584c\u3002\u8fd9\u4f1a\u5bfc\u81f4\u5feb\u901f\u7684\u51b0\u5c42\u635f\u5931\u548c\u6d77\u5e73\u9762\u4e0a\u5347\u3002'
    : 'The ice cliff exceeds critical height and may collapse under its own weight. This drives rapid ice loss and sea level rise.';

  drawTooltipPanel(ctx, {
    x: width / 2 - panelW / 2,
    y: 55, // below MISI panel
    maxWidth: panelW,
    padding: 8,
    bgColor: `rgba(50, 25, 0, ${0.85 + pulse * 0.1})`,
    borderColor: `rgba(255, 140, 0, ${0.4 + pulse * 0.3})`,
    borderRadius: 6,
    borderWidth: 2,
    titleFont: 'bold 12px "Nunito", sans-serif',
    titleColor: `rgba(255, 170, 50, ${0.8 + pulse * 0.2})`,
    title,
    bodyFont: '11px "Nunito", sans-serif',
    bodyColor: 'rgba(255, 220, 180, 0.85)',
    body,
    lineHeight: 15,
  });
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
