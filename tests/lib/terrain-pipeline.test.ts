import { describe, expect, it } from 'vitest';

import { parseDatasetMeta, type DatasetMeta } from '../../src/lib/terrain/binary-decoder';
import { buildTerrain } from '../../src/lib/terrain/terrain-build';
import { LOAD_PROGRESS, mapBuildProgress } from '../../src/lib/terrain/terrain-loader';
import { collectTerrainTransferables, type TerrainBuildRequest } from '../../src/lib/terrain/terrain-types';

const N = 4;
const CELLS = N * N;
const FILL = -32768;

function int16Field(values: number[]): Int16Array {
  return Int16Array.from(values);
}

/** 4 × 4 BedMachine-like dataset: ice (mask 2) in the 2 × 2 centre, one missing bed cell. */
function buildRequest(): TerrainBuildRequest {
  const bed = int16Field(Array.from({ length: CELLS }, (_, i) => (i === 15 ? FILL : -200 + 10 * i)));
  const surface = int16Field(Array.from({ length: CELLS }, (_, i) => 1500 + i));
  const thickness = int16Field(Array.from({ length: CELLS }, () => 900));
  const mask = Uint8Array.from({ length: CELLS }, (_, i) => ([5, 6, 9, 10].includes(i) ? 2 : 0));

  const bedBuffer = new ArrayBuffer(CELLS * 2 * 3 + CELLS);
  new Int16Array(bedBuffer, 0, CELLS).set(bed);
  new Int16Array(bedBuffer, CELLS * 2, CELLS).set(surface);
  new Int16Array(bedBuffer, CELLS * 4, CELLS).set(thickness);
  new Uint8Array(bedBuffer, CELLS * 6, CELLS).set(mask);

  const velocityBuffer = new ArrayBuffer(CELLS * 4);
  new Int16Array(velocityBuffer, 0, CELLS).set(int16Field(Array.from({ length: CELLS }, () => 30)));
  new Int16Array(velocityBuffer, CELLS * 2, CELLS).set(int16Field(Array.from({ length: CELLS }, () => 40)));

  const grid = { nx: N, ny: N, x0_m: -15_000, y0_m: 15_000, dx_m: 10_000, dy_m: -10_000 };
  const quantization = { int16_fill_value: FILL, scale: 1, offset: 0 };
  const bedMeta: DatasetMeta = parseDatasetMeta({
    grid, quantization,
    fields: [
      { name: 'bed', dtype: 'int16', byte_offset: 0, byte_length: CELLS * 2 },
      { name: 'surface', dtype: 'int16', byte_offset: CELLS * 2, byte_length: CELLS * 2 },
      { name: 'thickness', dtype: 'int16', byte_offset: CELLS * 4, byte_length: CELLS * 2 },
      { name: 'mask', dtype: 'uint8', byte_offset: CELLS * 6, byte_length: CELLS },
    ],
  }, 'BedMachine');
  const velocityMeta: DatasetMeta = parseDatasetMeta({
    grid, quantization,
    fields: [
      { name: 'vx', dtype: 'int16', byte_offset: 0, byte_length: CELLS * 2 },
      { name: 'vy', dtype: 'int16', byte_offset: CELLS * 2, byte_length: CELLS * 2 },
      { name: 'speed', unit: 'm/year', stats_m_per_year: { max: 50 } }, // stats only, as in the real file
    ],
  }, 'Velocity');

  return {
    type: 'buildAll',
    bedMeta, bedBuffer, velocityMeta, velocityBuffer,
    oceanLut: [[0, 0, 1], [0, 0.5, 1]],
    landLut: [[0, 1, 0], [1, 1, 1]],
  };
}

describe('parseDatasetMeta', () => {
  it('keeps binary field descriptors and drops stats-only entries', () => {
    const meta = parseDatasetMeta({
      grid: { nx: 2, ny: 2, x0_m: 0, y0_m: 0, dx_m: 1, dy_m: -1 },
      quantization: { int16_fill_value: FILL, scale: 1, offset: 0 },
      fields: [
        { name: 'vx', dtype: 'int16', byte_offset: 0, byte_length: 8 },
        { name: 'speed', stats_m_per_year: { max: 1 } },
      ],
    }, 'Velocity');
    expect(meta.fields.map((f) => f.name)).toEqual(['vx']);
  });

  it('rejects malformed metadata', () => {
    expect(() => parseDatasetMeta(null, 'X')).toThrow(/malformed/);
    expect(() => parseDatasetMeta({ grid: { nx: 'a' }, quantization: {}, fields: [] }, 'X')).toThrow(/grid/);
    expect(() => parseDatasetMeta({
      grid: { nx: 2, ny: 2, x0_m: 0, y0_m: 0, dx_m: 1, dy_m: -1 },
      quantization: { int16_fill_value: 'x', scale: 1, offset: 0 },
      fields: [],
    }, 'X')).toThrow(/quantization/);
  });
});

describe('buildTerrain', () => {
  it('builds every mesh with normals, grid metadata and velocity texels', () => {
    const progress: number[] = [];
    const terrain = buildTerrain(buildRequest(), (_step, p) => progress.push(p));

    expect(terrain.grid).toEqual({ nx: N, ny: N, x0_m: -15_000, y0_m: 15_000, dx_m: 10_000, dy_m: -10_000 });
    expect(progress).toEqual([...progress].sort((a, b) => a - b));

    for (const mesh of [terrain.bed, terrain.ice, terrain.iceBottom, terrain.iceSide]) {
      expect(mesh.normals.length).toBe(mesh.positions.length);
      expect(mesh.indices.length % 3).toBe(0);
    }
    expect(terrain.bedHeights[15]).toBeNaN();
    expect(terrain.ice.indices.length / 3).toBe(2); // one 2 × 2 ice cell
    expect(terrain.iceSide.positions.length / 3).toBe(4 * 6); // four boundary walls
    expect(terrain.velocity.textureData.length).toBe(CELLS * 4);
    expect(Array.from(terrain.velocity.textureData.subarray(5 * 4, 5 * 4 + 4))).toEqual([30, 40, 1, 0]);
    expect(Array.from(terrain.velocity.textureData.subarray(0, 4))).toEqual([0, 0, 0, 0]); // no ice → invalid
  });

  it('lists each transferable buffer once', () => {
    const terrain = buildTerrain(buildRequest(), () => undefined);
    const buffers = collectTerrainTransferables(terrain);
    expect(new Set(buffers).size).toBe(buffers.length);
    expect(buffers.length).toBe(3 + 4 * 4 + 5);
  });

  it('rejects a velocity grid that does not match the bed grid', () => {
    const request = buildRequest();
    const badVelocity = parseDatasetMeta({
      grid: request.velocityMeta.grid,
      quantization: request.velocityMeta.quantization,
      fields: [
        { name: 'vx', dtype: 'int16', byte_offset: 0, byte_length: 8 },
        { name: 'vy', dtype: 'int16', byte_offset: 8, byte_length: 8 },
      ],
    }, 'Velocity');
    expect(() => buildTerrain({ ...request, velocityMeta: badVelocity }, () => undefined)).toThrow(/does not match/);
  });
});

describe('mapBuildProgress', () => {
  it('maps worker progress after the download milestones so the bar never moves back', () => {
    expect(mapBuildProgress(0)).toBe(LOAD_PROGRESS.buildStart);
    expect(mapBuildProgress(0.1)).toBeGreaterThan(LOAD_PROGRESS.buildStart);
    expect(mapBuildProgress(0.1)).toBeGreaterThan(LOAD_PROGRESS.parse);
    expect(mapBuildProgress(1)).toBeLessThan(1);
    expect(mapBuildProgress(2)).toBe(mapBuildProgress(1));
    expect(mapBuildProgress(Number.NaN)).toBe(LOAD_PROGRESS.buildStart);
  });
});
