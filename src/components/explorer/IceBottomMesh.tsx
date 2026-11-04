/**
 * Ice bottom (base) surface mesh — darker blue tones, slightly rougher than the top.
 * Opacity tracks the ice opacity slider at 82% intensity (min 0.12).
 * Stays mounted while hidden (toggling `visible` keeps the compiled material).
 */

import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';
import { ICE_BOTTOM_RENDER_ORDER } from '../../lib/terrain/constants';
import { useTerrainGeometry } from './useTerrainGeometry';

export default function IceBottomMesh() {
  const iceBottomArrays = useExplorerStore((s) => s.terrain?.iceBottom);
  const showIce = useExplorerStore((s) => s.showIce);
  const iceOpacity = useExplorerStore((s) => s.iceOpacity);
  const geometry = useTerrainGeometry(iceBottomArrays);

  if (!geometry) return null;

  // Ice bottom opacity = surface opacity × 0.82, minimum 0.12
  const bottomOpacity = Math.max(0.12, iceOpacity * 0.82);

  return (
    <mesh geometry={geometry} renderOrder={ICE_BOTTOM_RENDER_ORDER} visible={showIce}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={bottomOpacity}
        roughness={0.44}
        metalness={0.02}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}
