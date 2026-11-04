/**
 * Backing-store sizing for the 2D simulation canvas.
 *
 * The same capped device-pixel ratio must size the bitmap AND scale the
 * drawing; otherwise (DPR > cap) the content is laid out for a larger canvas
 * than the CSS box and hover, tooltip and penguin hit tests drift.
 */

/** Highest pixel density rendered; beyond 2× the cost outweighs the sharpness. */
export const MAX_CANVAS_DPR = 2;

export interface CanvasSize {
  /** Layout size in CSS pixels (drawing and pointer coordinates). */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Device-pixel ratio actually used (capped). */
  readonly dpr: number;
  /** Backing-store size in device pixels. */
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

/** The device-pixel ratio to render at: finite, positive, at most `maxDpr`. */
export function resolveCanvasDpr(devicePixelRatio: number | undefined, maxDpr: number = MAX_CANVAS_DPR): number {
  const raw = typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  return Math.min(raw, maxDpr);
}

export function computeCanvasSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number | undefined,
  maxDpr: number = MAX_CANVAS_DPR,
): CanvasSize {
  const dpr = resolveCanvasDpr(devicePixelRatio, maxDpr);
  const width = Number.isFinite(cssWidth) ? Math.max(0, cssWidth) : 0;
  const height = Number.isFinite(cssHeight) ? Math.max(0, cssHeight) : 0;
  return {
    cssWidth: width,
    cssHeight: height,
    dpr,
    pixelWidth: Math.round(width * dpr),
    pixelHeight: Math.round(height * dpr),
  };
}

/**
 * Call `onChange` whenever window.devicePixelRatio changes (browser zoom,
 * moving the window to another monitor). Returns an unsubscribe function.
 */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined;

  let query: MediaQueryList | null = null;
  const handleChange = () => {
    onChange();
    listen(); // the old query no longer matches; watch the new ratio
  };
  const listen = () => {
    query?.removeEventListener('change', handleChange);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', handleChange);
  };

  listen();
  return () => query?.removeEventListener('change', handleChange);
}

export function sameCanvasSize(a: CanvasSize | null, b: CanvasSize): boolean {
  return a !== null
    && a.cssWidth === b.cssWidth
    && a.cssHeight === b.cssHeight
    && a.dpr === b.dpr
    && a.pixelWidth === b.pixelWidth
    && a.pixelHeight === b.pixelHeight;
}
