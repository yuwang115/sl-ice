/**
 * Camera animation for the slice transition.
 * Smoothly flies the camera toward the target flowline point,
 * then adds a glow effect at the intersection.
 *
 * The glow light is always mounted (intensity 0 when idle): adding a light
 * mid-flight changes the scene's light count, which forces three.js to
 * recompile every lit program — a multi-second stall on software GL.
 */

import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useExplorerStore, type TransitionPhase } from '../../store/explorer-store';
import {
  clampFrameDelta,
  computeFlyInEndPosition,
  flyInFrame,
} from '../../lib/camera-flyin';

interface Flight {
  readonly target: readonly [number, number, number];
  readonly startPos: THREE.Vector3;
  readonly endPos: THREE.Vector3;
  readonly startLookAt: THREE.Vector3;
  readonly endLookAt: THREE.Vector3;
  elapsed: number;
}

/** The orbit target of the default controls (OrbitControls uses makeDefault). */
function getOrbitTarget(controls: unknown): THREE.Vector3 | null {
  if (typeof controls !== 'object' || controls === null || !('target' in controls)) return null;
  const { target } = controls as { target: unknown };
  return target instanceof THREE.Vector3 ? target : null;
}

function beginFlight(
  camera: THREE.Camera,
  orbitTarget: THREE.Vector3 | null,
  target: readonly [number, number, number],
): Flight {
  const camPos = camera.position;
  const end = computeFlyInEndPosition([camPos.x, camPos.y, camPos.z], target);
  return {
    target,
    startPos: camPos.clone(),
    endPos: new THREE.Vector3(...end),
    startLookAt: orbitTarget ? orbitTarget.clone() : new THREE.Vector3(),
    endLookAt: new THREE.Vector3(...target),
    elapsed: 0,
  };
}

function isGlowPhase(phase: TransitionPhase): boolean {
  return phase === 'camera-zoom' || phase === 'slice';
}

export default function CameraAnimator() {
  const lightRef = useRef<THREE.PointLight>(null);
  const flightRef = useRef<Flight | null>(null);
  const lookAtRef = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const { isTransitioning, transitionTargetPoint: target, transitionPhase } = useExplorerStore.getState();
    const light = lightRef.current;

    if (!isTransitioning || !target) {
      flightRef.current = null;
      if (light) light.intensity = 0;
      return;
    }

    const orbitTarget = getOrbitTarget(state.controls);
    if (!flightRef.current || flightRef.current.target !== target) {
      flightRef.current = beginFlight(state.camera, orbitTarget, target);
    }
    const flight = flightRef.current;
    flight.elapsed += clampFrameDelta(delta);
    const frame = flyInFrame(flight.elapsed);

    state.camera.position.lerpVectors(flight.startPos, flight.endPos, frame.positionT);
    lookAtRef.current.lerpVectors(flight.startLookAt, flight.endLookAt, frame.lookAtT);
    state.camera.lookAt(lookAtRef.current);

    // Keep the orbit target in sync so the controls resume from here.
    orbitTarget?.copy(lookAtRef.current);

    if (light) {
      light.position.copy(flight.endLookAt);
      light.intensity = isGlowPhase(transitionPhase) ? frame.glow : 0;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      color="#38bdf8"
      intensity={0}
      distance={30}
      decay={2}
    />
  );
}
