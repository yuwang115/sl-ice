/**
 * Wrap worker-built mesh arrays (positions, normalized vertex colours,
 * precomputed normals, indices) in a BufferGeometry, disposing GPU buffers
 * when the arrays change or the component unmounts.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { LitMeshArrays } from '../../lib/terrain/mesh-builder';

export function createTerrainGeometry(arrays: LitMeshArrays): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(arrays.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
  return geometry;
}

export function useTerrainGeometry(arrays: LitMeshArrays | null | undefined): THREE.BufferGeometry | null {
  const geometry = useMemo(() => (arrays ? createTerrainGeometry(arrays) : null), [arrays]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  return geometry;
}
