import { describe, expect, it } from 'vitest';

import { interpolateGrid, lonLatToPS, psToGrid, type GridParams } from '../../src/lib/terrain/projection';

const nx = 3;
const ny = 3;
// Row-major 3 × 3 grid with value = 10·row + col
const data = new Float32Array([0, 1, 2, 10, 11, 12, 20, 21, 22]);

describe('interpolateGrid', () => {
  it('interpolates bilinearly inside the grid', () => {
    expect(interpolateGrid(0.5, 0.5, data, nx, ny)).toBeCloseTo(5.5);
    expect(interpolateGrid(1.25, 0, data, nx, ny)).toBeCloseTo(1.25);
  });

  it('accepts the last row/column exactly', () => {
    expect(interpolateGrid(2, 2, data, nx, ny)).toBe(22);
    expect(interpolateGrid(2, 0.5, data, nx, ny)).toBeCloseTo(7);
  });

  it('returns NaN outside the grid on every side', () => {
    expect(interpolateGrid(-0.01, 1, data, nx, ny)).toBeNaN();
    expect(interpolateGrid(1, -0.01, data, nx, ny)).toBeNaN();
    // Previously c1 was clamped, so this guard never fired past the last column/row.
    expect(interpolateGrid(2.5, 1, data, nx, ny)).toBeNaN();
    expect(interpolateGrid(1, 2.5, data, nx, ny)).toBeNaN();
  });

  it('returns NaN for non-finite coordinates', () => {
    expect(interpolateGrid(Number.NaN, 1, data, nx, ny)).toBeNaN();
    expect(interpolateGrid(1, Number.POSITIVE_INFINITY, data, nx, ny)).toBeNaN();
  });

  it('falls back to the nearest node when a neighbour is missing', () => {
    const holey = new Float32Array(data);
    holey[4] = Number.NaN; // centre node
    expect(interpolateGrid(0.2, 0.2, holey, nx, ny)).toBe(0);
    expect(interpolateGrid(0.9, 0.9, holey, nx, ny)).toBeNaN();
  });
});

describe('lonLatToPS (catalog longitude convention)', () => {
  // First point of thwaites-flowline-01: true EPSG:3031 grid coordinates and
  // the stored (mirrored) longitude / latitude from the scenario file.
  const x = -1117339.0;
  const y = -244893.8;
  const storedLon = -77.63763;
  const lat = -79.50058;

  it('maps a stored catalog lon/lat onto the true EPSG:3031 grid position', () => {
    const ps = lonLatToPS(storedLon, lat);
    expect(Math.abs(ps.x - x)).toBeLessThan(25);
    expect(Math.abs(ps.y - y)).toBeLessThan(25);
  });

  it('documents that stored longitudes are mirrored (180° − true longitude)', () => {
    const trueLon = (Math.atan2(x, y) * 180) / Math.PI; // EPSG:3031: λ = atan2(x, y)
    expect(trueLon).toBeCloseTo(-102.36, 1);
    const mirrored = ((180 - trueLon + 540) % 360) - 180;
    expect(mirrored).toBeCloseTo(storedLon, 3);
  });

  it('feeds psToGrid with BedMachine grid indices', () => {
    const grid: GridParams = { x0_m: -3_333_000, y0_m: 3_333_000, dx_m: 10_000, dy_m: -10_000, nx: 667, ny: 667 };
    const { col, row } = psToGrid(x, y, grid);
    expect(col).toBeCloseTo((x + 3_333_000) / 10_000);
    expect(row).toBeCloseTo((y - 3_333_000) / -10_000);
  });
});
