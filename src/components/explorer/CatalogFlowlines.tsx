/**
 * Render 100 Antarctic flowlines as interactive 3D lines.
 * Each line can be hovered (brighten) and clicked (select/activate).
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useExplorerStore } from '../../store/explorer-store';
import { projectFlowlinePath } from '../../lib/terrain/projection';
import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';
import type { ThreeEvent } from '@react-three/fiber';

// ── Types ────────────────────────────────────────────────────────────

interface FlowlinePath {
  readonly id: string;
  readonly points: [number, number, number][];
  readonly color: string;
}

interface CatalogFlowlinesProps {
  catalog: FlowlineCatalogEntry[];
}

// ── Brighten a hex color ─────────────────────────────────────────────

function brightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = Math.min(255, Math.round(r + (255 - r) * factor));
  const bg = Math.min(255, Math.round(g + (255 - g) * factor));
  const bb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${br.toString(16).padStart(2, '0')}${bg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
}

// ── Main Component ───────────────────────────────────────────────────

export default function CatalogFlowlines({ catalog }: CatalogFlowlinesProps) {
  const hoveredId = useExplorerStore((s) => s.hoveredFlowlineId);
  const selectedId = useExplorerStore((s) => s.selectedFlowlineId);
  const setHovered = useExplorerStore((s) => s.setHoveredFlowline);
  const setSelected = useExplorerStore((s) => s.setSelectedFlowline);
  const startTransition = useExplorerStore((s) => s.startTransition);
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const transitionFlowlineId = useExplorerStore((s) => s.transitionFlowlineId);
  const showFlowlines = useExplorerStore((s) => s.showFlowlines);
  const exaggeration = useExplorerStore((s) => s.exaggeration);

  const surfaceHeights = useExplorerStore((s) => s.surfaceHeights);
  const gridNx = useExplorerStore((s) => s.gridNx);
  const gridNy = useExplorerStore((s) => s.gridNy);
  const hScale = useExplorerStore((s) => s.horizontalMetersPerUnit);
  const vScale = useExplorerStore((s) => s.verticalMetersPerUnit);

  // Read grid params from the loaded bedmachine meta (stored alongside surfaceHeights)
  // We need x0_m, y0_m, dx_m, dy_m — these are fixed for the 480 dataset
  const gridParams = useMemo(() => ({
    x0_m: -3_333_000,
    y0_m: 3_333_000,
    dx_m: 10_000,
    dy_m: -10_000,
    nx: gridNx,
    ny: gridNy,
  }), [gridNx, gridNy]);

  // Project all flowline paths to 3D scene coordinates
  const flowlinePaths = useMemo<FlowlinePath[]>(() => {
    if (!surfaceHeights || gridNx === 0) return [];

    return catalog
      .filter((entry) => entry.path_lonlat && entry.path_lonlat.length >= 2)
      .map((entry) => ({
        id: entry.id,
        points: projectFlowlinePath(
          entry.path_lonlat,
          gridParams,
          hScale,
          vScale,
          surfaceHeights,
          gridNx,
          gridNy,
        ),
        color: entry.color || '#3b82f6',
      }));
  }, [catalog, surfaceHeights, gridParams, hScale, vScale, gridNx, gridNy]);

  if (!showFlowlines || flowlinePaths.length === 0) return null;

  return (
    <group scale={[1, exaggeration, 1]}>
      {flowlinePaths.map((fl) => (
        <FlowlineLine
          key={fl.id}
          id={fl.id}
          points={fl.points}
          color={fl.color}
          isHovered={fl.id === hoveredId}
          isSelected={fl.id === selectedId}
          isActivating={isTransitioning && fl.id === transitionFlowlineId}
          isFading={isTransitioning && fl.id !== transitionFlowlineId}
          onHover={setHovered}
          onSelect={setSelected}
          onActivate={startTransition}
          isTransitioning={isTransitioning}
        />
      ))}
    </group>
  );
}

// ── Single Flowline ──────────────────────────────────────────────────

interface FlowlineLineProps {
  id: string;
  points: [number, number, number][];
  color: string;
  isHovered: boolean;
  isSelected: boolean;
  isActivating: boolean;
  isFading: boolean;
  isTransitioning: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onActivate: (flowlineId: string, targetPoint: [number, number, number] | null) => void;
}

function FlowlineLine({
  id, points, color,
  isHovered, isSelected,
  isActivating, isFading, isTransitioning,
  onHover, onSelect, onActivate,
}: FlowlineLineProps) {
  const lastClickRef = useRef(0);

  // Determine visual properties
  let lineWidth: number;
  let lineColor: string;

  if (isActivating) {
    lineWidth = 6;
    lineColor = '#ffffff';
  } else if (isFading) {
    lineWidth = 0.5;
    lineColor = '#1e293b';
  } else if (isSelected) {
    lineWidth = 4.5;
    lineColor = '#fbbf24';
  } else if (isHovered) {
    lineWidth = 3;
    lineColor = brightenHex(color, 0.5);
  } else {
    lineWidth = 1.5;
    lineColor = color;
  }

  // Create tube geometry for raycasting (Line doesn't support it reliably)
  const tubeGeo = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
    );
    return new THREE.TubeGeometry(curve, points.length * 2, 0.4, 4, false);
  }, [points]);

  // Dispose GPU buffers when tube geometry changes
  useEffect(() => {
    return () => { tubeGeo?.dispose(); };
  }, [tubeGeo]);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (isTransitioning) return;
      onHover(id);
    },
    [id, onHover, isTransitioning],
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (isTransitioning) return;
      onHover(null);
    },
    [onHover, isTransitioning],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (isTransitioning) return;

      const now = Date.now();
      // Each FlowlineLine has its own lastClickRef, so the time check
      // naturally scopes to the same flowline. We avoid checking
      // `isSelected` (a prop) because R3F may not have re-rendered with
      // the updated prop between rapid clicks, causing the double-click
      // to be swallowed.
      if (now - lastClickRef.current < 500) {
        const pt = e.point;
        onActivate(id, [pt.x, pt.y, pt.z]);
      } else {
        onSelect(id);
      }
      lastClickRef.current = now;
    },
    [id, isTransitioning, onSelect, onActivate],
  );

  if (points.length < 2) return null;

  return (
    <group>
      {/* Visible line */}
      <Line
        points={points}
        color={lineColor}
        lineWidth={lineWidth}
        renderOrder={16}
      />

      {/* Invisible tube for raycasting */}
      {tubeGeo && (
        <mesh
          geometry={tubeGeo}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
          visible={false}
        >
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
