/**
 * Ice surface mesh — semi-transparent, thickness-colored.
 * Stays mounted while hidden (toggling `visible` keeps the compiled material).
 */

import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';
import { ICE_SURFACE_RENDER_ORDER } from '../../lib/terrain/constants';
import { useTerrainGeometry } from './useTerrainGeometry';

export default function IceSurfaceMesh() {
  const iceArrays = useExplorerStore((s) => s.terrain?.ice);
  const showIce = useExplorerStore((s) => s.showIce);
  const iceOpacity = useExplorerStore((s) => s.iceOpacity);
  const geometry = useTerrainGeometry(iceArrays);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={ICE_SURFACE_RENDER_ORDER} visible={showIce}>
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
