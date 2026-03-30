/**
 * Ice side-wall mesh matching the original 3d-ice explorer silhouette.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';
import { ICE_SIDE_RENDER_ORDER } from '../../lib/terrain/constants';

export default function IceSideMesh() {
  const iceSideArrays = useExplorerStore((s) => s.iceSideArrays);
  const showIce = useExplorerStore((s) => s.showIce);
  const iceOpacity = useExplorerStore((s) => s.iceOpacity);

  const geometry = useMemo(() => {
    if (!iceSideArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(iceSideArrays.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(iceSideArrays.colors, 3, true));
    geo.setIndex(new THREE.BufferAttribute(iceSideArrays.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [iceSideArrays]);

  if (!geometry || !showIce) return null;

  return (
    <mesh geometry={geometry} renderOrder={ICE_SIDE_RENDER_ORDER}>
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
