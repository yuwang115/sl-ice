/**
 * Ice surface mesh — semi-transparent, thickness-colored.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';
import { ICE_SURFACE_RENDER_ORDER } from '../../lib/terrain/constants';

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
    <mesh geometry={geometry} renderOrder={ICE_SURFACE_RENDER_ORDER}>
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={iceOpacity}
        roughness={0.24}
        metalness={0.02}
        clearcoat={0.42}
        clearcoatRoughness={0.16}
        specularIntensity={0.5}
        specularColor={0xe8f7ff}
        ior={1.31}
        side={THREE.DoubleSide}
        depthWrite
      />
    </mesh>
  );
}
