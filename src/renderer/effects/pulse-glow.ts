/**
 * Pulse glow overlay effect for critical events.
 */

let glowColor = 'rgba(255, 68, 68, 0)';
let glowStartTime = 0;
let glowDuration = 0;

export function triggerGlow(
  color: string = 'rgba(255, 68, 68',
  durationMs: number = 1000,
): void {
  glowColor = color;
  glowStartTime = Date.now();
  glowDuration = durationMs;
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  if (glowDuration <= 0) return;

  const elapsed = Date.now() - glowStartTime;
  if (elapsed > glowDuration) {
    glowDuration = 0;
    return;
  }

  // Pulse: fade in then fade out
  const t = elapsed / glowDuration;
  const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
  const intensity = Math.max(0, alpha * 0.15);

  // Vignette glow from edges
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `${glowColor}, ${intensity})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
