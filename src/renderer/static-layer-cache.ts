/**
 * Offscreen cache for the 2D canvas's static layers (bedrock + ice body).
 *
 * Those layers depend only on the physics state, the scenario and the canvas
 * size, yet were repainted every frame — including while paused. Once the
 * same state object has been drawn for a few consecutive frames, the layers
 * are painted once into an offscreen canvas of identical pixel size and
 * blitted 1:1 afterwards. A running simulation (new state most frames) keeps
 * painting directly, so the cache never adds work while it would be stale.
 */

export interface StaticLayerKey {
  readonly state: object;
  readonly scenario: object;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpr: number;
}

/** Paints the layers in CSS-pixel coordinates onto the given context. */
export type StaticLayerPainter = (ctx: CanvasRenderingContext2D) => void;

export interface StaticLayerCache {
  /** Draw the layers onto `target` (current transform = DPR scale · screen shake). */
  draw: (target: CanvasRenderingContext2D, key: StaticLayerKey, paint: StaticLayerPainter) => void;
  /** Free the offscreen bitmap. */
  release: () => void;
}

/** Consecutive frames with the same state before the cache is (re)built. */
const STABLE_FRAMES_BEFORE_CACHING = 2;

function sameKey(a: StaticLayerKey | null, b: StaticLayerKey): boolean {
  return a !== null
    && a.state === b.state
    && a.scenario === b.scenario
    && a.pixelWidth === b.pixelWidth
    && a.pixelHeight === b.pixelHeight
    && a.dpr === b.dpr;
}

function paintDirect(target: CanvasRenderingContext2D, paint: StaticLayerPainter): void {
  target.save();
  paint(target);
  target.restore();
}

/** Copy the cache 1:1 in device pixels, keeping only the translation (screen shake). */
function blit(target: CanvasRenderingContext2D, source: HTMLCanvasElement): void {
  const { e, f } = target.getTransform();
  target.save();
  target.setTransform(1, 0, 0, 1, e, f);
  target.drawImage(source, 0, 0);
  target.restore();
}

export function createStaticLayerCache(
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): StaticLayerCache {
  let canvas: HTMLCanvasElement | null = null;
  let cachedKey: StaticLayerKey | null = null;
  let lastState: object | null = null;
  let stableFrames = 0;

  const rebuild = (key: StaticLayerKey, paint: StaticLayerPainter): boolean => {
    canvas ??= createCanvas();
    if (canvas.width !== key.pixelWidth) canvas.width = key.pixelWidth;
    if (canvas.height !== key.pixelHeight) canvas.height = key.pixelHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, key.pixelWidth, key.pixelHeight);
    ctx.setTransform(key.dpr, 0, 0, key.dpr, 0, 0);
    paintDirect(ctx, paint);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    cachedKey = key;
    return true;
  };

  return {
    draw: (target, key, paint) => {
      stableFrames = key.state === lastState ? stableFrames + 1 : 0;
      lastState = key.state;

      const reusable = canvas !== null && sameKey(cachedKey, key);
      if (!reusable && (stableFrames < STABLE_FRAMES_BEFORE_CACHING || key.pixelWidth === 0 || key.pixelHeight === 0)) {
        paintDirect(target, paint);
        return;
      }
      if (!reusable && !rebuild(key, paint)) {
        paintDirect(target, paint);
        return;
      }
      if (canvas) blit(target, canvas);
    },
    release: () => {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvas = null;
      cachedKey = null;
      lastState = null;
      stableFrames = 0;
    },
  };
}
