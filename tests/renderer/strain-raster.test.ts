import { describe, expect, it } from 'vitest';

import {
  rasterizeStrainField,
  STRAIN_COLOR_LUT,
  STRAIN_LOG_MAX,
  STRAIN_LOG_MIN,
  strainColumnStep,
  strainLayerStep,
} from '../../src/renderer/strain-raster';

/** LUT index exactly as the former per-quad fillRect loop computed it. */
function referenceIndex(u: Float64Array, H: Float64Array, dx: number, nz: number, dsigma: number, i: number, j: number) {
  const dudx = (u[(i + 1) * nz + j] - u[(i - 1) * nz + j]) / (2 * dx);
  const jUp = Math.min(j + 1, nz - 1);
  const jDn = Math.max(j - 1, 0);
  const dudsigma = (u[i * nz + jUp] - u[i * nz + jDn]) / ((jUp - jDn) * dsigma);
  const dudz = dudsigma / Math.max(H[i], 1);
  const eps = Math.sqrt(dudx * dudx + 0.25 * dudz * dudz + 1e-20);
  const t = (Math.log10(eps) - STRAIN_LOG_MIN) / (STRAIN_LOG_MAX - STRAIN_LOG_MIN);
  return Math.max(0, Math.min(255, Math.round(t * 255)));
}

function buildField(nx: number, nz: number) {
  const dsigma = 1 / (nz - 1);
  const dx = 2000;
  const u = new Float64Array(nx * nz);
  const H = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    H[i] = i % 7 === 3 ? 5 : 800 + 10 * i; // some columns too thin to draw
    for (let j = 0; j < nz; j++) {
      u[i * nz + j] = 50 + 3 * i + 40 * Math.pow(j * dsigma, 4) * (1 + 0.01 * i);
    }
  }
  return { u, H, dx, dsigma };
}

function texel(data: Uint8ClampedArray, cols: number, row: number, col: number): number[] {
  const offset = (row * cols + col) * 4;
  return Array.from(data.subarray(offset, offset + 4));
}

describe('rasterizeStrainField', () => {
  it.each([
    { nx: 50, nz: 11 },   // xStep 1, jStep 1
    { nx: 401, nz: 20 },  // xStep 2, jStep 2 with a half-height top block
  ])('matches the per-quad colours of the former renderer (nx=$nx, nz=$nz)', ({ nx, nz }) => {
    const { u, H, dx, dsigma } = buildField(nx, nz);
    const raster = rasterizeStrainField({ u2d: u, H, dx, nx, nz, dsigma });
    const xStep = strainColumnStep(nx);
    const jStep = strainLayerStep(nz);

    expect(raster.rows).toBe(nz - 1);
    expect(raster.cols).toBe(Math.ceil((nx - 2) / xStep));

    for (let c = 0; c < raster.cols; c++) {
      const i = raster.nodeIndex[c];
      expect(i).toBe(1 + c * xStep);
      for (let r = 0; r < raster.rows; r++) {
        const imageRow = raster.rows - 1 - r; // row 0 is the surface
        const actual = texel(raster.data, raster.cols, imageRow, c);
        if (H[i] < 10) {
          expect(actual[3]).toBe(0);
          continue;
        }
        const j = Math.floor(r / jStep) * jStep;
        const idx = referenceIndex(u, H, dx, nz, dsigma, i, j);
        expect(actual).toEqual(Array.from(STRAIN_COLOR_LUT.subarray(idx * 4, idx * 4 + 4)));
      }
    }
  });

  it('reuses the raster buffers when the grid size is unchanged', () => {
    const { u, H, dx, dsigma } = buildField(60, 11);
    const first = rasterizeStrainField({ u2d: u, H, dx, nx: 60, nz: 11, dsigma });
    const second = rasterizeStrainField({ u2d: u, H, dx, nx: 60, nz: 11, dsigma }, first);
    expect(second).toBe(first);
    const resized = rasterizeStrainField({ u2d: u, H, dx, nx: 40, nz: 11, dsigma }, first);
    expect(resized).not.toBe(first);
  });

  it('leaves undefined strain (NaN velocities) transparent', () => {
    const nx = 10;
    const nz = 5;
    const u = new Float64Array(nx * nz).fill(Number.NaN);
    const H = new Float64Array(nx).fill(1000);
    const raster = rasterizeStrainField({ u2d: u, H, dx: 1000, nx, nz, dsigma: 0.25 });
    for (let k = 3; k < raster.data.length; k += 4) expect(raster.data[k]).toBe(0);
  });

  it('uses the heatmap opacity (0.75) in the colour table', () => {
    expect(STRAIN_COLOR_LUT[3]).toBe(Math.round(0.75 * 255));
  });
});
