import { describe, expect, it, vi } from 'vitest';

import { createStaticLayerCache, type StaticLayerKey } from '../../src/renderer/static-layer-cache';

interface FakeContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  setTransform: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  getTransform: () => { e: number; f: number };
}

function fakeContext(): FakeContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getTransform: () => ({ e: 4, f: -2 }), // DPR scale · screen-shake translation
  };
}

function setup() {
  const offscreenCtx = fakeContext();
  const offscreen = { width: 0, height: 0, getContext: () => offscreenCtx };
  const cache = createStaticLayerCache(() => offscreen as unknown as HTMLCanvasElement);
  const target = fakeContext();
  const targetCtx = target as unknown as CanvasRenderingContext2D;
  const paint = vi.fn();
  return { cache, target, targetCtx, offscreen, offscreenCtx, paint };
}

const scenario = {};
const keyFor = (state: object, pixelWidth = 200): StaticLayerKey => ({
  state, scenario, pixelWidth, pixelHeight: 100, dpr: 2,
});

describe('createStaticLayerCache', () => {
  it('paints directly while the physics state keeps changing', () => {
    const { cache, targetCtx, target, paint } = setup();
    for (let i = 0; i < 5; i++) cache.draw(targetCtx, keyFor({}), paint);
    expect(paint).toHaveBeenCalledTimes(5);
    expect(paint.mock.calls.every(([ctx]) => ctx === targetCtx)).toBe(true);
    expect(target.drawImage).not.toHaveBeenCalled();
  });

  it('caches once the same state has been drawn for a few frames, then only blits', () => {
    const { cache, targetCtx, target, offscreen, offscreenCtx, paint } = setup();
    const state = {};
    for (let i = 0; i < 6; i++) cache.draw(targetCtx, keyFor(state), paint);

    // 2 direct frames, 1 offscreen build, then blits only.
    expect(paint).toHaveBeenCalledTimes(3);
    expect(paint.mock.calls[2][0]).toBe(offscreenCtx);
    expect(offscreen.width).toBe(200);
    expect(offscreen.height).toBe(100);
    expect(offscreenCtx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(target.drawImage).toHaveBeenCalledTimes(4);
    // Blitted 1:1 in device pixels, keeping only the translation.
    expect(target.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 4, -2);
  });

  it('rebuilds immediately when the canvas is resized while paused', () => {
    const { cache, targetCtx, paint, offscreen } = setup();
    const state = {};
    for (let i = 0; i < 4; i++) cache.draw(targetCtx, keyFor(state), paint);
    const paintsBefore = paint.mock.calls.length;
    cache.draw(targetCtx, keyFor(state, 300), paint);
    expect(paint).toHaveBeenCalledTimes(paintsBefore + 1);
    expect(offscreen.width).toBe(300);
  });

  it('frees the offscreen bitmap on release', () => {
    const { cache, targetCtx, paint, offscreen } = setup();
    const state = {};
    for (let i = 0; i < 4; i++) cache.draw(targetCtx, keyFor(state), paint);
    cache.release();
    expect(offscreen.width).toBe(0);
    expect(offscreen.height).toBe(0);
  });
});
