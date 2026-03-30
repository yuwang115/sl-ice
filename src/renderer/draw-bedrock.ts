/**
 * Draw bedrock terrain on the canvas.
 */

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  // Coordinate mapping
  xMin: number;   // Domain x min (m)
  xMax: number;   // Domain x max (m)
  zMin: number;   // Elevation min (m)
  zMax: number;   // Elevation max (m)
}

/** Map domain coordinates to canvas pixels */
export function toCanvasX(domainX: number, dc: DrawContext): number {
  return ((domainX - dc.xMin) / (dc.xMax - dc.xMin)) * dc.width;
}

export function toCanvasY(domainZ: number, dc: DrawContext): number {
  // Canvas Y is inverted (0 at top)
  return dc.height - ((domainZ - dc.zMin) / (dc.zMax - dc.zMin)) * dc.height;
}

/**
 * Draw the bedrock profile with texture-like gradient.
 */
export function drawBedrock(
  dc: DrawContext,
  b: Float64Array,
  xPositions: Float64Array,
): void {
  const { ctx, width, height } = dc;

  // Create gradient for bedrock
  const gradient = ctx.createLinearGradient(0, toCanvasY(0, dc), 0, height);
  gradient.addColorStop(0, '#5C4033');
  gradient.addColorStop(1, '#3D2B1F');

  ctx.beginPath();

  // Start from bottom-left
  ctx.moveTo(0, height);

  // Draw bedrock surface
  for (let i = 0; i < b.length; i++) {
    const cx = toCanvasX(xPositions[i], dc);
    const cy = toCanvasY(b[i], dc);
    if (i === 0) {
      ctx.lineTo(cx, cy);
    } else {
      ctx.lineTo(cx, cy);
    }
  }

  // Close along the bottom
  ctx.lineTo(width, height);
  ctx.closePath();

  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw bedrock surface line
  ctx.beginPath();
  for (let i = 0; i < b.length; i++) {
    const cx = toCanvasX(xPositions[i], dc);
    const cy = toCanvasY(b[i], dc);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.strokeStyle = '#8B6914';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
