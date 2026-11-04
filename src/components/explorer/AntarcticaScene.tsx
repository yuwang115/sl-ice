/**
 * AntarcticaScene — R3F Canvas containing bedrock, ice, velocity, and flowlines.
 *
 * Terrain comes from the explorer store (loaded by useTerrainLoader in the
 * explorer). Once it is available the meshes mount hidden, every shader is
 * pre-compiled (SceneWarmup), and only then is the scene revealed and the
 * loading overlay removed — so neither the first frame nor a later layer
 * toggle stalls on shader compilation.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

import { useExplorerStore } from '../../store/explorer-store';
import { useUIStore } from '../../store/ui-store';
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  DEFAULT_AUTO_ROTATE_SPEED,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  FOG_FAR,
  FOG_NEAR,
  ORBIT_MAX_DISTANCE,
  ORBIT_MIN_DISTANCE,
  SCENE_BACKGROUND,
} from '../../lib/terrain/constants';
import { getAutoRotateResumeDelay } from '../../lib/explorer-interactions';
import { getWheelDollyScale, normalizeWheelDeltaY } from '../../lib/wheel-zoom';
import { isWebGLAvailable } from '../../lib/webgl-support';
import ErrorBoundary from '../layout/ErrorBoundary';

import BedrockMesh from './BedrockMesh';
import IceSurfaceMesh from './IceSurfaceMesh';
import IceSideMesh from './IceSideMesh';
import IceBottomMesh from './IceBottomMesh';
import VelocityOverlay from './VelocityOverlay';
import CatalogFlowlines from './CatalogFlowlines';
import CameraAnimator from './CameraAnimator';
import LoadingOverlay from './LoadingOverlay';
import SceneControls from './SceneControls';
import SceneWarmup from './SceneWarmup';
import WebGLUnavailable from './WebGLUnavailable';

import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

// ── Scene Content (inside Canvas) ────────────────────────────────────

interface SceneContentProps {
  catalog: FlowlineCatalogEntry[];
  /** False while the meshes are pre-compiling behind the loading overlay. */
  revealed: boolean;
}

function SceneContent({ catalog, revealed }: SceneContentProps) {
  const exaggeration = useExplorerStore((s) => s.exaggeration);

  return (
    <>
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <fog attach="fog" args={[SCENE_BACKGROUND, FOG_NEAR, FOG_FAR]} />

      <ambientLight color={0xddefff} intensity={0.75} />
      <directionalLight color={0xffffff} intensity={0.9} position={[12, 18, 8]} />
      <directionalLight color={0x95c9e7} intensity={0.35} position={[-14, 6, -9]} />

      <group visible={revealed}>
        <group scale={[1, exaggeration, 1]}>
          <BedrockMesh />
          <IceSurfaceMesh />
          <IceSideMesh />
          <IceBottomMesh />
          <VelocityOverlay />
        </group>
        <CatalogFlowlines catalog={catalog} />
      </group>

      <CameraAnimator />
      <ExplorerOrbitControls />
    </>
  );
}

function ExplorerOrbitControls() {
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const selectedFlowlineId = useExplorerStore((s) => s.selectedFlowlineId);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const autoRotateEnabledRef = useRef(true);
  const controlKeyActiveRef = useRef(false);
  const lastSelectedFlowlineRef = useRef<string | null>(null);

  const syncAutoRotate = useCallback((enabled: boolean) => {
    autoRotateEnabledRef.current = enabled;

    const controls = controlsRef.current;
    if (!controls) return;

    controls.autoRotate = enabled && !isTransitioning;
    controls.update();
  }, [isTransitioning]);

  // Aim at the default target once. Re-running this on every transition
  // start would yank the view back before the fly-in begins.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(...DEFAULT_CAMERA_TARGET);
    controls.update();
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const pauseAutoRotate = useCallback(() => {
    clearResumeTimer();
    syncAutoRotate(false);
  }, [clearResumeTimer, syncAutoRotate]);

  const scheduleAutoRotateResume = useCallback((interaction: 'idle' | 'flowline-selection' = 'idle') => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      syncAutoRotate(true);
    }, getAutoRotateResumeDelay(interaction));
  }, [clearResumeTimer, syncAutoRotate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        controlKeyActiveRef.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') {
        controlKeyActiveRef.current = false;
      }
    };

    const handleBlur = () => {
      controlKeyActiveRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    const dom = controls?.domElement;
    if (!dom) return;

    const handlePointerDown = () => pauseAutoRotate();
    const handlePointerUp = () => scheduleAutoRotateResume('idle');
    const handleWheel = (event: WheelEvent) => {
      pauseAutoRotate();
      scheduleAutoRotateResume('idle');

      if (!controls || !controls.enabled || !controls.enableZoom) return;

      const deltaY = normalizeWheelDeltaY(event, controlKeyActiveRef.current);
      if (deltaY === 0) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const dollyScale = getWheelDollyScale(deltaY, controls.zoomSpeed);
      if (deltaY < 0) {
        controls.dollyIn(dollyScale);
      } else {
        controls.dollyOut(dollyScale);
      }
    };

    dom.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      clearResumeTimer();
      dom.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel, true);
    };
  }, [clearResumeTimer, pauseAutoRotate, scheduleAutoRotateResume]);

  useEffect(() => {
    const previousSelectedFlowlineId = lastSelectedFlowlineRef.current;
    lastSelectedFlowlineRef.current = selectedFlowlineId;

    if (
      !selectedFlowlineId ||
      selectedFlowlineId === previousSelectedFlowlineId ||
      isTransitioning
    ) {
      return;
    }

    pauseAutoRotate();
    scheduleAutoRotateResume('flowline-selection');
  }, [isTransitioning, pauseAutoRotate, scheduleAutoRotateResume, selectedFlowlineId]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (isTransitioning) {
      clearResumeTimer();
      if (controls) {
        controls.autoRotate = false;
        controls.update();
      }
      return;
    }

    if (controls) {
      controls.autoRotate = autoRotateEnabledRef.current;
      controls.update();
    }
  }, [clearResumeTimer, isTransitioning]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!isTransitioning}
      enableDamping
      dampingFactor={0.08}
      minDistance={ORBIT_MIN_DISTANCE}
      maxDistance={ORBIT_MAX_DISTANCE}
      autoRotateSpeed={DEFAULT_AUTO_ROTATE_SPEED}
    />
  );
}

// ── Main Component ───────────────────────────────────────────────────

interface AntarcticaSceneProps {
  catalog: FlowlineCatalogEntry[];
  onSimulate: (entry: FlowlineCatalogEntry) => void;
}

export default function AntarcticaScene({ catalog, onSimulate }: AntarcticaSceneProps) {
  const hasTerrain = useExplorerStore((s) => s.terrain !== null);
  const selectedFlowlineId = useExplorerStore((s) => s.selectedFlowlineId);
  const [webglAvailable] = useState(isWebGLAvailable);
  // Per Canvas: a revisit with cached terrain still needs its shaders compiled.
  const [shadersReady, setShadersReady] = useState(false);
  const handleShadersReady = useCallback(() => setShadersReady(true), []);

  if (!webglAvailable) {
    return (
      <div className="relative w-full h-full">
        <WebGLUnavailable reason="unsupported" />
      </div>
    );
  }

  const revealed = hasTerrain && shadersReady;

  return (
    <div className="relative w-full h-full">
      <ErrorBoundary fallback={<WebGLUnavailable reason="crashed" />}>
        <Canvas
          camera={{ fov: CAMERA_FOV, near: CAMERA_NEAR, far: CAMERA_FAR, position: [...DEFAULT_CAMERA_POSITION] }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <SceneContent catalog={catalog} revealed={revealed} />
          {hasTerrain && !shadersReady && <SceneWarmup onReady={handleShadersReady} />}
        </Canvas>
      </ErrorBoundary>

      {/* Overlay UI */}
      {!revealed && <LoadingOverlay warming={hasTerrain} />}
      {revealed && <SceneControls />}

      {/* Selected flowline action button */}
      {selectedFlowlineId && revealed && (
        <SelectedFlowlineAction
          flowlineId={selectedFlowlineId}
          catalog={catalog}
          onSimulate={onSimulate}
        />
      )}
    </div>
  );
}

// ── Selected Flowline Floating Action ────────────────────────────────

function SelectedFlowlineAction({
  flowlineId,
  catalog,
  onSimulate,
}: {
  flowlineId: string;
  catalog: FlowlineCatalogEntry[];
  onSimulate: (entry: FlowlineCatalogEntry) => void;
}) {
  const zh = useUIStore((s) => s.language) === 'zh';
  const entry = catalog.find((c) => c.id === flowlineId);
  if (!entry) return null;

  const name = zh ? entry.name_zh : entry.name_en;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <button
        onClick={() => onSimulate(entry)}
        className="pill-btn px-4 py-2 text-sm font-medium"
        style={{
          background: 'rgba(56, 189, 248, 0.2)',
          borderColor: 'rgba(56, 189, 248, 0.6)',
          color: '#e0f2fe',
        }}
      >
        {'▶'} {zh ? `模拟 ${name}` : `Simulate ${name}`}
      </button>
    </div>
  );
}
