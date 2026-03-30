/**
 * Ice surface mesh — semi-transparent, thickness-colored.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';

export default function IceSurfaceMesh() {
  const iceArrays = useExplorerStore((s) => s.iceArrays);
  const showIce = useExplorerStore((s) => s.showIce);
  const iceOpacity = useExplorerStore((s) => s.iceOpacity);

  const geometry = useMemo(() => {
    if (!iceArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(iceArrays.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(iceArrays.colors, 3, true));
    geo.setIndex(new THREE.BufferAttribute(iceArrays.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [iceArrays]);

  if (!geometry || !showIce) return null;

  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={iceOpacity}
        roughness={0.38}
        metalness={0.02}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
