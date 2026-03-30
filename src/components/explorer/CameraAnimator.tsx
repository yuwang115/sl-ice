/**
 * Camera animation for the slice transition.
 * Smoothly flies the camera toward the target flowline point,
 * then adds a glow effect at the intersection.
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useExplorerStore } from '../../store/explorer-store';

/** Deceleration ease — fast start, gentle stop. */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export default function CameraAnimator() {
  const { camera } = useThree();
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const targetPoint = useExplorerStore((s) => s.transitionTargetPoint);
  const phase = useExplorerStore((s) => s.transitionPhase);

  // Animation state (refs to avoid re-renders)
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const endLookAt = useRef(new THREE.Vector3());
  const tmpLookAt = useRef(new THREE.Vector3());
  const elapsed = useRef(0);
  const initialized = useRef(false);

  const lightRef = useRef<THREE.PointLight>(null);

  const CAMERA_DURATION = 1.4; // seconds

  useFrame((state, delta) => {
    if (!isTransitioning || !targetPoint) {
      if (initialized.current) {
        initialized.current = false;
        elapsed.current = 0;
      }
      return;
    }

    // Initialize on first frame of animation
    if (!initialized.current) {
      initialized.current = true;
      elapsed.current = 0;
      startPos.current.copy(camera.position);
      endLookAt.current.set(targetPoint[0], targetPoint[1], targetPoint[2]);

      // Current orbit target as start look-at
      const controls = state.controls as unknown as { target?: THREE.Vector3 };
      if (controls?.target) {
        startLookAt.current.copy(controls.target);
      } else {
        startLookAt.current.set(0, 0, 0);
      }

      // End position: 8 units from the target, along the current viewing direction
      const dir = new THREE.Vector3()
        .subVectors(camera.position, endLookAt.current)
        .normalize();
      endPos.current.copy(endLookAt.current).addScaledVector(dir, 8);
    }

    elapsed.current += delta;
    const rawT = Math.min(1, elapsed.current / CAMERA_DURATION);
    const t = easeOutQuart(rawT);

    // Smoothly interpolate camera position
    camera.position.lerpVectors(startPos.current, endPos.current, t);

    // Look-at converges faster than position for a cinematic pull
    const lookAtT = easeOutQuart(Math.min(1, rawT * 1.3));
    tmpLookAt.current.lerpVectors(startLookAt.current, endLookAt.current, lookAtT);
    camera.lookAt(tmpLookAt.current);

    // Keep orbit controls target in sync (if they re-enable later)
    const controls = state.controls as unknown as { target?: THREE.Vector3 };
    if (controls?.target) {
      controls.target.copy(tmpLookAt.current);
    }

    // Ramp up the glow light at the target point
    if (lightRef.current) {
      lightRef.current.intensity = Math.min(6, rawT * 8);
    }
  });

  // Render a point light at the target for a warm glow during zoom + slice
  const showGlow =
    isTransitioning &&
    targetPoint &&
    (phase === 'camera-zoom' || phase === 'slice');

  if (!showGlow) return null;

  return (
    <pointLight
      ref={lightRef}
      position={[targetPoint[0], targetPoint[1], targetPoint[2]]}
      color="#38bdf8"
      intensity={0}
      distance={30}
      decay={2}
    />
  );
}
