/**
 * Screen shake effect for dramatic moments (ice collapse).
 */

let shakeIntensity = 0;
let shakeDuration = 0;
let shakeStartTime = 0;

export function triggerShake(intensity: number = 5, durationMs: number = 500): void {
  shakeIntensity = intensity;
  shakeDuration = durationMs;
  shakeStartTime = Date.now();
}

export function getShakeOffset(): { x: number; y: number } {
  if (shakeDuration <= 0) return { x: 0, y: 0 };

  const elapsed = Date.now() - shakeStartTime;
  if (elapsed > shakeDuration) {
    shakeDuration = 0;
    return { x: 0, y: 0 };
  }

  const decay = 1 - elapsed / shakeDuration;
  const intensity = shakeIntensity * decay;

  return {
    x: (Math.random() - 0.5) * 2 * intensity,
    y: (Math.random() - 0.5) * 2 * intensity,
  };
}

export function isShaking(): boolean {
  return shakeDuration > 0 && (Date.now() - shakeStartTime) < shakeDuration;
}
