/**
 * Velocity heatmap overlay mesh.
 * Matches the original 3D-ICE explorer by preferring continuous shader sampling
 * from the raw velocity field, with vertex colors as a fallback.
 * The texture texels are packed by the geometry worker; the mesh stays mounted
 * while hidden so toggling the layer never recompiles the shader.
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
  const velocityArrays = useExplorerStore((s) => s.terrain?.velocity);
  const grid = useExplorerStore((s) => s.terrain?.grid);
  const showVelocity = useExplorerStore((s) => s.showVelocity);
  const nx = grid?.nx ?? 0;
  const ny = grid?.ny ?? 0;

  const renderData = useMemo(() => {
    if (!velocityArrays) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(velocityArrays.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(velocityArrays.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(velocityArrays.indices, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(velocityArrays.colors, 3, true));

    const texture = nx > 0 && ny > 0
      ? createVelocityDataTexture(velocityArrays, nx, ny, gl)
      : null;

    const material = texture
      ? createVelocitySurfaceShaderMaterial(texture, nx, ny)
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
  }, [gl, nx, ny, velocityArrays]);

  useEffect(() => () => {
    renderData?.geometry.dispose();
    renderData?.material.dispose();
    renderData?.texture?.dispose();
  }, [renderData]);

  if (!renderData) return null;

  return (
    <mesh
      geometry={renderData.geometry}
      material={renderData.material}
      renderOrder={12}
      visible={showVelocity}
    />
  );
}
