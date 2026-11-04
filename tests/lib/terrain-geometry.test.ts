import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { computeVertexNormals } from '../../src/lib/terrain/grid-normals';
import {
  buildGridUvs,
  buildIceSideArrays,
  buildSurfaceArrays,
  computeScaleFactors,
} from '../../src/lib/terrain/mesh-builder';
import { buildVelocityTextureData } from '../../src/lib/terrain/velocity-field';

const flatColor = () => [0.5, 0.5, 0.5] as [number, number, number];

function heightfield(nx: number, ny: number, valid?: (i: number) => boolean) {
  const heights = new Float32Array(nx * ny);
  const mask = new Uint8Array(nx * ny);
  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const i = row * nx + col;
      heights[i] = 1000 * Math.sin(col * 0.7) * Math.cos(row * 0.4) + 37 * ((i * 7919) % 13);
      mask[i] = valid ? (valid(i) ? 1 : 0) : 1;
    }
  }
  return { heights, mask };
}

const geometry = { nx: 9, ny: 7, dxMeters: 10_000, dyMeters: -10_000, horizontalMetersPerUnit: 52_000, verticalMetersPerUnit: 3_800 };

describe('computeVertexNormals (worker port)', () => {
  it('matches three.js BufferGeometry.computeVertexNormals bit for bit', () => {
    const { heights, mask } = heightfield(geometry.nx, geometry.ny, (i) => i % 11 !== 5);
    const mesh = buildSurfaceArrays({ ...geometry, heights, valid: mask, colorFn: flatColor });

    const reference = new THREE.BufferGeometry();
    reference.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    reference.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    reference.computeVertexNormals();
    const expected = reference.getAttribute('normal').array as Float32Array;

    expect(Array.from(computeVertexNormals(mesh.positions, mesh.indices))).toEqual(Array.from(expected));
  });

  it('leaves unreferenced vertices with a zero normal and normalises the rest', () => {
    const { heights } = heightfield(3, 3);
    const valid = new Uint8Array([1, 1, 0, 1, 1, 0, 0, 0, 0]);
    const mesh = buildSurfaceArrays({ ...geometry, nx: 3, ny: 3, heights, valid, colorFn: flatColor });
    const normals = computeVertexNormals(mesh.positions, mesh.indices);
    expect(Array.from(normals.subarray(6, 9))).toEqual([0, 0, 0]); // vertex 2 is unused
    const n0 = normals.subarray(0, 3);
    expect(Math.hypot(n0[0], n0[1], n0[2])).toBeCloseTo(1, 6);
    expect(n0[1]).toBeGreaterThan(0); // grid triangles face up
  });
});

describe('mesh builder', () => {
  it('only triangulates cells whose corners are valid', () => {
    const { heights } = heightfield(3, 3);
    const valid = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 0]);
    const mesh = buildSurfaceArrays({ ...geometry, nx: 3, ny: 3, heights, valid, colorFn: flatColor });
    // 4 cells × 2 triangles, minus the one triangle touching the invalid corner
    expect(mesh.indices.length / 3).toBe(7);
    expect(Array.from(mesh.indices).includes(8)).toBe(false);
  });

  it('builds side walls along the outer boundary only', () => {
    const nx = 4;
    const ny = 4;
    const top = new Float32Array(nx * ny).fill(2000);
    const bottom = new Float32Array(nx * ny).fill(500);
    const valid = new Uint8Array(nx * ny).fill(1);
    const side = buildIceSideArrays({
      ...geometry, nx, ny, topHeights: top, bottomHeights: bottom, valid, colorFn: flatColor,
    });
    // 3 boundary edges per side × 4 sides, 2 triangles (6 vertices) each
    expect(side.positions.length / 3).toBe(12 * 6);
    expect(Array.from(side.indices)).toEqual(Array.from({ length: 72 }, (_, i) => i));
  });

  it('spans UVs over the grid and computes 3D-ICE scale factors', () => {
    const uvs = buildGridUvs(3, 2);
    expect(Array.from(uvs)).toEqual([0, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 1, 1, 1]);
    const scales = computeScaleFactors(667, 667, 10_000, -10_000);
    expect(scales.horizontalMetersPerUnit).toBeCloseTo((666 * 10_000) / 128);
    expect(scales.verticalMetersPerUnit).toBeCloseTo(scales.horizontalMetersPerUnit / (52_000 / 3_800));
  });
});

describe('buildVelocityTextureData', () => {
  it('packs (vx, vy, valid, 0) and zeroes invalid cells', () => {
    const data = buildVelocityTextureData(
      new Float32Array([1.5, -2, 9]),
      new Float32Array([3, 4, 9]),
      new Uint8Array([1, 1, 0]),
    );
    expect(Array.from(data)).toEqual([1.5, 3, 1, 0, -2, 4, 1, 0, 0, 0, 0, 0]);
  });

  it('rejects mismatched inputs', () => {
    expect(() => buildVelocityTextureData(new Float32Array(2), new Float32Array(3), new Uint8Array(3))).toThrow();
  });
});
