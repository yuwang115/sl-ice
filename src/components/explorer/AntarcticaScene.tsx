/**
 * AntarcticaScene — R3F Canvas containing bedrock, ice, velocity, and flowlines.
 * Manages data loading via a custom hook that orchestrates fetch → worker → store.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

import { useExplorerStore } from '../../store/explorer-store';
import { useUIStore } from '../../store/ui-store';
import { loadGmtReliefColormap } from '../../lib/terrain/colormap-loader';
import { SCENE_BACKGROUND, FOG_NEAR, FOG_FAR } from '../../lib/terrain/constants';

import BedrockMesh from './BedrockMesh';
import IceSurfaceMesh from './IceSurfaceMesh';
import IceBottomMesh from './IceBottomMesh';
import VelocityOverlay from './VelocityOverlay';
import CatalogFlowlines from './CatalogFlowlines';
import CameraAnimator from './CameraAnimator';
import LoadingOverlay from './LoadingOverlay';
import SceneControls from './SceneControls';

import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

// ── Terrain Loader Hook ──────────────────────────────────────────────

function useTerrainLoader() {
  const loadingStage = useExplorerStore((s) => s.loadingStage);
  const setLoadingStage = useExplorerStore((s) => s.setLoadingStage);
  const setError = useExplorerStore((s) => s.setError);
  const setScaleFactors = useExplorerStore((s) => s.setScaleFactors);
  const setSurfaceHeights = useExplorerStore((s) => s.setSurfaceHeights);
  const setBedArrays = useExplorerStore((s) => s.setBedArrays);
  const setIceArrays = useExplorerStore((s) => s.setIceArrays);
  const setIceBottomArrays = useExplorerStore((s) => s.setIceBottomArrays);
  const setVelocityArrays = useExplorerStore((s) => s.setVelocityArrays);
  const setBedColorTable = useExplorerStore((s) => s.setBedColorTable);

  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadingStage !== 'idle' || loadedRef.current) return;
    loadedRef.current = true;

    const run = async () => {
      try {
        setLoadingStage('fetching', 0.05, 'Fetching terrain data...');

        // Parallel fetch: bin files + meta files + colormap
        const [bedMetaRes, bedBinRes, velMetaRes, velBinRes, colorTable] = await Promise.all([
          fetch('/3d-ice/data/bedmachine_antarctica_v4_480.meta.json'),
          fetch('/3d-ice/data/bedmachine_antarctica_v4_480.bin'),
          fetch('/3d-ice/data/antarctic_ice_velocity_phase_v01_480.meta.json'),
          fetch('/3d-ice/data/antarctic_ice_velocity_phase_v01_480.bin'),
          loadGmtReliefColormap(),
        ]);

        if (!bedMetaRes.ok || !bedBinRes.ok || !velMetaRes.ok || !velBinRes.ok) {
          throw new Error('Failed to fetch terrain assets');
        }

        setBedColorTable(colorTable);

        setLoadingStage('decoding', 0.2, 'Decoding binary data...');

        const bedMeta = await bedMetaRes.json();
        const bedBuffer = await bedBinRes.arrayBuffer();
        const velocityMeta = await velMetaRes.json();
        const velocityBuffer = await velBinRes.arrayBuffer();

        setLoadingStage('building', 0.3, 'Building 3D geometry...');

        // Send to worker
        const worker = new Worker(
          new URL('../../lib/terrain/geometry.worker.ts', import.meta.url),
          { type: 'module' },
        );

        worker.onmessage = (e) => {
          const data = e.data;

          if (data.type === 'progress') {
            setLoadingStage('building', data.progress, data.stage);
            return;
          }

          if (data.type === 'error') {
            setError(data.message);
            worker.terminate();
            return;
          }

          if (data.type === 'result') {
            setScaleFactors(data.hScale, data.vScale);
            setSurfaceHeights(data.surface, data.nx, data.ny);
            setBedArrays(data.bed);
            setIceArrays(data.ice);
            setIceBottomArrays(data.iceBottom);
            setVelocityArrays(data.velocity);
            setLoadingStage('ready', 1.0, 'Complete');
            worker.terminate();
          }
        };

        worker.onerror = (err) => {
          setError(err.message || 'Worker error');
          worker.terminate();
        };

        worker.postMessage(
          {
            type: 'buildAll',
            bedMeta,
            bedBuffer,
            velocityMeta,
            velocityBuffer,
            oceanLut: colorTable.ocean,
            landLut: colorTable.land,
          },
          [bedBuffer, velocityBuffer],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    run();
  }, [
    loadingStage,
    setLoadingStage, setError, setScaleFactors, setSurfaceHeights,
    setBedArrays, setIceArrays, setIceBottomArrays, setVelocityArrays, setBedColorTable,
  ]);
}

// ── Scene Content (inside Canvas) ────────────────────────────────────

function SceneContent() {
  const exaggeration = useExplorerStore((s) => s.exaggeration);
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);

  return (
    <>
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <fog attach="fog" args={[SCENE_BACKGROUND, FOG_NEAR, FOG_FAR]} />

      <ambientLight color={0xddefff} intensity={0.75} />
      <directionalLight color={0xffffff} intensity={0.9} position={[12, 18, 8]} />
      <directionalLight color={0x95c9e7} intensity={0.35} position={[-14, 6, -9]} />

      <group scale={[1, exaggeration, 1]}>
        <BedrockMesh />
        <IceSurfaceMesh />
        <IceBottomMesh />
        <VelocityOverlay />
      </group>

      <CameraAnimator />

      <OrbitControls
        enabled={!isTransitioning}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={360}
        zoomSpeed={0.8}
      />
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────

interface AntarcticaSceneProps {
  catalog: FlowlineCatalogEntry[];
  onSimulate: (entry: FlowlineCatalogEntry) => void;
}

export default function AntarcticaScene({ catalog, onSimulate }: AntarcticaSceneProps) {
  const loadingStage = useExplorerStore((s) => s.loadingStage);
  const selectedFlowlineId = useExplorerStore((s) => s.selectedFlowlineId);

  // Start data loading
  useTerrainLoader();

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 200, position: [0, 60, 80] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <SceneContent />
        {loadingStage === 'ready' && (
          <CatalogFlowlines catalog={catalog} />
        )}
      </Canvas>

      {/* Overlay UI */}
      {loadingStage !== 'ready' && <LoadingOverlay />}
      {loadingStage === 'ready' && <SceneControls />}

      {/* Selected flowline action button */}
      {selectedFlowlineId && loadingStage === 'ready' && (
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
  const entry = catalog.find((c) => c.id === flowlineId);
  if (!entry) return null;

  const zh = useUIStore.getState().language === 'zh';
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
