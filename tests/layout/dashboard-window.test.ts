import {
  applyDashboardMove,
  applyDashboardResize,
  clampDashboardRect,
  createDefaultDashboardRect,
  type FloatingDashboardRect,
} from '../../src/components/layout/dashboard-window';

describe('dashboard-window helpers', () => {
  it('creates a default rect that fits within the viewport bounds', () => {
    const rect = createDefaultDashboardRect(1200, 800);

    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1200);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
  });

  it('clamps moved windows so they stay inside the simulation viewport', () => {
    const rect: FloatingDashboardRect = { x: 40, y: 30, width: 520, height: 260 };

    expect(applyDashboardMove(rect, 900, 700, 1000, 700)).toEqual({
      x: 464,
      y: 424,
      width: 520,
      height: 260,
    });
  });

  it('resizes from the south-east handle while respecting viewport bounds', () => {
    const rect: FloatingDashboardRect = { x: 120, y: 100, width: 540, height: 260 };

    expect(applyDashboardResize(rect, 'se', 600, 400, 1000, 700)).toEqual({
      x: 120,
      y: 100,
      width: 864,
      height: 584,
    });
  });

  it('keeps north-west resizing above minimum size and within bounds', () => {
    const rect: FloatingDashboardRect = { x: 120, y: 100, width: 540, height: 260 };

    expect(applyDashboardResize(rect, 'nw', 500, 300, 1000, 700)).toEqual({
      x: 180,
      y: 120,
      width: 480,
      height: 240,
    });
  });

  it('clamps arbitrary rects back into bounds', () => {
    expect(clampDashboardRect({ x: -20, y: -30, width: 1200, height: 900 }, 900, 600)).toEqual({
      x: 16,
      y: 16,
      width: 868,
      height: 568,
    });
  });
});
