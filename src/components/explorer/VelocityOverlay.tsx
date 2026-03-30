/**
 * Velocity heatmap overlay mesh — blue→cyan→yellow→red, logarithmic scale.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useExplorerStore } from '../../store/explorer-store';

export default function VelocityOverlay() {
  const velocityArrays = useExplorerStore((s) => s.velocityArrays);
  const showVelocity = useExplorerStore((s) => s.showVelocity);

  const geometry = useMemo(() => {
    if (!velocityArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(velocityArrays.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(velocityArrays.colors, 3, true));
    geo.setIndex(new THREE.BufferAttribute(velocityArrays.indices, 1));
    // No normals needed — uses MeshBasicMaterial (unlit)
    return geo;
  }, [velocityArrays]);

  if (!geometry || !showVelocity) return null;

  return (
    <mesh geometry={geometry} renderOrder={12}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.82}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
