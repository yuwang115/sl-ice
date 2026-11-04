/**
 * Ice side-wall mesh matching the original 3d-ice explorer silhouette.
 * Stays mounted while hidden (toggling `visible` keeps the compiled material).
 */

import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';
import { ICE_SIDE_RENDER_ORDER } from '../../lib/terrain/constants';
import { useTerrainGeometry } from './useTerrainGeometry';

export default function IceSideMesh() {
  const iceSideArrays = useExplorerStore((s) => s.terrain?.iceSide);
  const showIce = useExplorerStore((s) => s.showIce);
  const iceOpacity = useExplorerStore((s) => s.iceOpacity);
  const geometry = useTerrainGeometry(iceSideArrays);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={ICE_SIDE_RENDER_ORDER} visible={showIce}>
      <meshPhysicalMaterial
        vertexColors
        transparent
        opacity={iceOpacity}
        roughness={0.28}
        metalness={0.02}
        clearcoat={0.28}
        clearcoatRoughness={0.2}
        specularIntensity={0.4}
        specularColor={0xddf3ff}
        ior={1.31}
        side={THREE.DoubleSide}
        depthWrite
      />
    </mesh>
  );
}
