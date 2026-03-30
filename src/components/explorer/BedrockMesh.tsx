/**
 * Bedrock surface mesh — GMT Relief colored terrain.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';

export default function BedrockMesh() {
  const bedArrays = useExplorerStore((s) => s.bedArrays);

  const geometry = useMemo(() => {
    if (!bedArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(bedArrays.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(bedArrays.colors, 3, true));
    geo.setIndex(new THREE.BufferAttribute(bedArrays.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [bedArrays]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
