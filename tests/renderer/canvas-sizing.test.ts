import { describe, expect, it } from 'vitest';

import {
  computeCanvasSize,
  MAX_CANVAS_DPR,
  resolveCanvasDpr,
  sameCanvasSize,
} from '../../src/renderer/canvas-sizing';

describe('resolveCanvasDpr', () => {
  it('caps high-density displays at MAX_CANVAS_DPR', () => {
    expect(resolveCanvasDpr(3)).toBe(MAX_CANVAS_DPR);
    expect(resolveCanvasDpr(2.625)).toBe(MAX_CANVAS_DPR);
  });

  it('keeps ratios at or below the cap', () => {
    expect(resolveCanvasDpr(1)).toBe(1);
    expect(resolveCanvasDpr(1.5)).toBe(1.5);
    expect(resolveCanvasDpr(2)).toBe(2);
  });

  it('falls back to 1 for missing or invalid ratios', () => {
    expect(resolveCanvasDpr(undefined)).toBe(1);
    expect(resolveCanvasDpr(0)).toBe(1);
    expect(resolveCanvasDpr(-2)).toBe(1);
    expect(resolveCanvasDpr(Number.NaN)).toBe(1);
  });
});

describe('computeCanvasSize', () => {
  it('sizes the backing store with the same capped DPR used for drawing (DPR 3)', () => {
    const size = computeCanvasSize(800, 450, 3);
    expect(size.dpr).toBe(2);
    expect(size.pixelWidth).toBe(1600);
    expect(size.pixelHeight).toBe(900);
    // Drawing in CSS px scaled by size.dpr fills the bitmap exactly, so CSS-px
    // pointer coordinates line up with what is drawn.
    expect(size.pixelWidth / size.dpr).toBe(size.cssWidth);
    expect(size.pixelHeight / size.dpr).toBe(size.cssHeight);
  });

  it('rounds fractional device sizes', () => {
    const size = computeCanvasSize(333, 201, 1.5);
    expect(size.pixelWidth).toBe(Math.round(333 * 1.5));
    expect(size.pixelHeight).toBe(Math.round(201 * 1.5));
  });

  it('clamps negative or invalid CSS sizes to zero', () => {
    const size = computeCanvasSize(-10, Number.NaN, 2);
    expect(size.cssWidth).toBe(0);
    expect(size.cssHeight).toBe(0);
    expect(size.pixelWidth).toBe(0);
    expect(size.pixelHeight).toBe(0);
  });
});

describe('sameCanvasSize', () => {
  it('detects DPR changes even when the CSS size is unchanged', () => {
    const atOne = computeCanvasSize(640, 480, 1);
    expect(sameCanvasSize(atOne, computeCanvasSize(640, 480, 1))).toBe(true);
    expect(sameCanvasSize(atOne, computeCanvasSize(640, 480, 2))).toBe(false);
    expect(sameCanvasSize(null, atOne)).toBe(false);
  });
});
