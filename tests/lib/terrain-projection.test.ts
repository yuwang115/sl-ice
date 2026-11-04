import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { FlowlineGeometry } from '../../src/engine/types';
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

describe('lonLatToPS (EPSG:3031)', () => {
  // Reference coordinates from PROJ (GDAL 3.3.2 gdaltransform, EPSG:4326 → EPSG:3031).
  const RHO_71S = 2_082_760.109; // ρ on the standard parallel, where the scale is true

  it('puts the prime meridian on +y and 90°E on +x', () => {
    const greenwich = lonLatToPS(0, -71);
    const east = lonLatToPS(90, -71);
    expect(greenwich.x).toBeCloseTo(0, 6);
    expect(greenwich.y).toBeCloseTo(RHO_71S, 2);
    expect(east.x).toBeCloseTo(RHO_71S, 2);
    expect(east.y).toBeCloseTo(0, 6);
  });

  it('projects Lake Vostok (106.8°E, 77.5°S) where PROJ does', () => {
    const vostok = lonLatToPS(106.8, -77.5);
    expect(vostok.x).toBeCloseTo(1_305_161.978, 2);
    expect(vostok.y).toBeCloseTo(-394_051.634, 2);
  });

  it('feeds psToGrid with BedMachine grid indices', () => {
    // First point of thwaites-flowline-01 in EPSG:3031 meters
    const x = -1117339.0;
    const y = -244893.8;
    const grid: GridParams = { x0_m: -3_333_000, y0_m: 3_333_000, dx_m: 10_000, dy_m: -10_000, nx: 667, ny: 667 };
    const { col, row } = psToGrid(x, y, grid);
    expect(col).toBeCloseTo((x + 3_333_000) / 10_000);
    expect(row).toBeCloseTo((y - 3_333_000) / -10_000);
  });
});

interface CatalogEntry {
  id: string;
  scenario: string;
  seed_lonlat: [number, number];
  path_lonlat: [number, number][];
}

function readData<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'public/data', path), 'utf8')) as T;
}

/** Distance (m) from a projected lon/lat to the nearest stored geometry point. */
function distanceToGeometry([lon, lat]: readonly [number, number], geometry: FlowlineGeometry): number {
  const { x, y } = lonLatToPS(lon, lat);
  return Math.min(...geometry.points.map((p) => Math.hypot(x - p.x_m, y - p.y_m)));
}

describe('stored flowline coordinates', () => {
  const flowlines = readData<CatalogEntry[]>('flowline-catalog.json').map((entry) => ({
    entry,
    geometry: readData<{ geometry: FlowlineGeometry }>(`scenarios/${entry.scenario}.json`).geometry,
  }));

  it('covers all 100 catalog flowlines', () => {
    expect(flowlines).toHaveLength(100);
  });

  it('projects every scenario point onto its stored EPSG:3031 x/y', () => {
    // lon/lat are stored to 1e-5° and x/y to 0.1 m, so under 1 m is exact agreement.
    let worst = 0;
    for (const { geometry } of flowlines) {
      for (const p of geometry.points) {
        const { x, y } = lonLatToPS(p.lon, p.lat);
        worst = Math.max(worst, Math.hypot(x - p.x_m, y - p.y_m));
      }
    }
    expect(worst).toBeLessThan(1);
  });

  it('puts every catalog path point on its flowline', () => {
    // path_lonlat is rounded to 1e-3°, i.e. up to ~60 m on the ground.
    for (const { entry, geometry } of flowlines) {
      const worst = Math.max(...entry.path_lonlat.map((q) => distanceToGeometry(q, geometry)));
      expect(worst, entry.id).toBeLessThan(100);
    }
  });

  it('puts every catalog seed on its flowline', () => {
    // The seed lies on the traced line, so within one sample spacing of a stored point.
    for (const { entry, geometry } of flowlines) {
      expect(distanceToGeometry(entry.seed_lonlat, geometry), entry.id).toBeLessThanOrEqual(
        geometry.spacing_km * 1000,
      );
    }
  });
});
