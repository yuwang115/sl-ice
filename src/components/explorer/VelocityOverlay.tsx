/**
 * Velocity heatmap overlay mesh.
 * Matches the original 3D-ICE explorer by preferring continuous shader sampling
 * from the raw velocity field, with vertex colors as a fallback.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useExplorerStore } from '../../store/explorer-store';
import {
  createVelocityDataTexture,
  createVelocitySurfaceShaderMaterial,
} from '../../lib/terrain/velocity-rendering';
import { VELOCITY_SURFACE_OPACITY } from '../../lib/terrain/constants';

export default function VelocityOverlay() {
  const gl = useThree((state) => state.gl);
  const velocityArrays = useExplorerStore((s) => s.velocityArrays);
  const showVelocity = useExplorerStore((s) => s.showVelocity);
  const gridNx = useExplorerStore((s) => s.gridNx);
  const gridNy = useExplorerStore((s) => s.gridNy);

  const renderData = useMemo(() => {
    if (!velocityArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(velocityArrays.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(velocityArrays.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(velocityArrays.indices, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(velocityArrays.colors, 3, true));

    const texture =
      gridNx > 0 && gridNy > 0
        ? createVelocityDataTexture(velocityArrays, gridNx, gridNy, gl)
        : null;

    const material = texture
      ? createVelocitySurfaceShaderMaterial(texture, gridNx, gridNy)
      : new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: VELOCITY_SURFACE_OPACITY,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      });

    return { geometry: geo, material, texture };
  }, [gl, gridNx, gridNy, velocityArrays]);

  useEffect(() => () => {
    renderData?.geometry.dispose();
    renderData?.material.dispose();
    renderData?.texture?.dispose();
  }, [renderData]);

  if (!renderData || !showVelocity) return null;

  return (
    <mesh
      geometry={renderData.geometry}
      material={renderData.material}
      renderOrder={12}
    />
  );
}
