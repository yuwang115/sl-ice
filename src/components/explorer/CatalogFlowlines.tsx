/**
 * Render the catalog's Antarctic flowlines as interactive 3D lines.
 * Each line can be hovered (brighten) and clicked (select / double-click to activate).
 *
 * Lines stay mounted while the layer is hidden (`visible` toggles, so the
 * line material is not recompiled); hidden lines are excluded from raycasting.
 * Picking ignores hits whose view ray passes through terrain, so a line hidden
 * behind a ridge does not highlight.
 */

import { useMemo, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useExplorerStore } from '../../store/explorer-store';
import { getFlowlineLineAppearance } from '../../lib/explorer-interactions';
import { createDoubleClickTracker } from '../../lib/double-click-tracker';
import { projectFlowlinePath } from '../../lib/terrain/projection';
import {
  buildOccluderHeights,
  createHeightSampler,
  isSegmentOccluded,
  type Vec3Like,
} from '../../lib/terrain/terrain-occlusion';
import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

// ── Types ────────────────────────────────────────────────────────────

interface FlowlinePath {
  readonly id: string;
  readonly points: [number, number, number][];
  readonly color: string;
}

interface CatalogFlowlinesProps {
  catalog: FlowlineCatalogEntry[];
}

interface FlowlinePointerHandlers {
  onHover: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onLeave: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onClick: (id: string, event: ThreeEvent<MouseEvent>) => void;
}

const meshRaycast = THREE.Mesh.prototype.raycast;
const noRaycast: THREE.Mesh['raycast'] = () => undefined;

// ── Hooks ────────────────────────────────────────────────────────────

function useFlowlinePaths(catalog: FlowlineCatalogEntry[]): FlowlinePath[] {
  const terrain = useExplorerStore((s) => s.terrain);

  return useMemo<FlowlinePath[]>(() => {
    if (!terrain) return [];
    const { grid } = terrain;

    return catalog
      .filter((entry) => entry.path_lonlat && entry.path_lonlat.length >= 2)
      .map((entry) => ({
        id: entry.id,
        points: projectFlowlinePath(
          entry.path_lonlat,
          grid,
          terrain.horizontalMetersPerUnit,
          terrain.verticalMetersPerUnit,
          terrain.surfaceHeights,
          grid.nx,
          grid.ny,
        ),
        color: entry.color || '#3b82f6',
      }));
  }, [catalog, terrain]);
}

/** Returns a test telling whether a pick hit is visible (not behind terrain). */
function useHitVisibility(): (origin: Vec3Like, point: Vec3Like) => boolean {
  const terrain = useExplorerStore((s) => s.terrain);
  const showIce = useExplorerStore((s) => s.showIce);
  const exaggeration = useExplorerStore((s) => s.exaggeration);

  const occluderHeights = useMemo(
    () => (terrain
      ? buildOccluderHeights(terrain.bedHeights, terrain.surfaceHeights, terrain.thicknessData, showIce)
      : null),
    [terrain, showIce],
  );

  const heightAt = useMemo(
    () => (terrain && occluderHeights
      ? createHeightSampler(occluderHeights, {
        grid: terrain.grid,
        horizontalMetersPerUnit: terrain.horizontalMetersPerUnit,
        verticalMetersPerUnit: terrain.verticalMetersPerUnit,
        exaggeration,
      })
      : null),
    [terrain, occluderHeights, exaggeration],
  );

  return useCallback(
    (origin: Vec3Like, point: Vec3Like) => !heightAt || !isSegmentOccluded(origin, point, heightAt),
    [heightAt],
  );
}

function useFlowlinePointerHandlers(): FlowlinePointerHandlers {
  const setHovered = useExplorerStore((s) => s.setHoveredFlowline);
  const setSelected = useExplorerStore((s) => s.setSelectedFlowline);
  const startTransition = useExplorerStore((s) => s.startTransition);
  const isHitVisible = useHitVisibility();
  // One shared record: A → B → A within the window is not a double-click.
  const clickTracker = useMemo(() => createDoubleClickTracker(), []);

  const onHover = useCallback((id: string, event: ThreeEvent<PointerEvent>) => {
    const state = useExplorerStore.getState();
    if (state.isTransitioning) {
      event.stopPropagation();
      return;
    }
    if (!isHitVisible(event.ray.origin, event.point)) {
      if (state.hoveredFlowlineId === id) setHovered(null);
      return; // let the event reach whatever is actually visible
    }
    event.stopPropagation();
    if (state.hoveredFlowlineId !== id) setHovered(id);
  }, [isHitVisible, setHovered]);

  const onLeave = useCallback((id: string, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const state = useExplorerStore.getState();
    if (!state.isTransitioning && state.hoveredFlowlineId === id) setHovered(null);
  }, [setHovered]);

  const onClick = useCallback((id: string, event: ThreeEvent<MouseEvent>) => {
    if (useExplorerStore.getState().isTransitioning) {
      event.stopPropagation();
      return;
    }
    if (!isHitVisible(event.ray.origin, event.point)) return;
    event.stopPropagation();

    if (clickTracker.register(id, performance.now())) {
      const { x, y, z } = event.point;
      startTransition(id, [x, y, z]);
    } else {
      setSelected(id);
    }
  }, [clickTracker, isHitVisible, setSelected, startTransition]);

  return useMemo(() => ({ onHover, onLeave, onClick }), [onHover, onLeave, onClick]);
}

// ── Main Component ───────────────────────────────────────────────────

export default function CatalogFlowlines({ catalog }: CatalogFlowlinesProps) {
  const hoveredId = useExplorerStore((s) => s.hoveredFlowlineId);
  const selectedId = useExplorerStore((s) => s.selectedFlowlineId);
  const setHovered = useExplorerStore((s) => s.setHoveredFlowline);
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const transitionFlowlineId = useExplorerStore((s) => s.transitionFlowlineId);
  const showFlowlines = useExplorerStore((s) => s.showFlowlines);
  const exaggeration = useExplorerStore((s) => s.exaggeration);

  const flowlinePaths = useFlowlinePaths(catalog);
  const handlers = useFlowlinePointerHandlers();

  // A hidden layer must not keep a stale 3D hover highlight.
  useEffect(() => {
    if (!showFlowlines) setHovered(null);
  }, [showFlowlines, setHovered]);

  if (flowlinePaths.length === 0) return null;

  return (
    <group scale={[1, exaggeration, 1]} visible={showFlowlines}>
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
          pickable={showFlowlines}
          handlers={handlers}
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
  pickable: boolean;
  handlers: FlowlinePointerHandlers;
}

function FlowlineLine({
  id, points, color,
  isHovered, isSelected,
  isActivating, isFading,
  pickable, handlers,
}: FlowlineLineProps) {
  const { lineWidth, lineColor } = getFlowlineLineAppearance({
    color,
    isHovered,
    isSelected,
    isActivating,
    isFading,
  });

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

  const handleHover = useCallback((e: ThreeEvent<PointerEvent>) => handlers.onHover(id, e), [handlers, id]);
  const handleLeave = useCallback((e: ThreeEvent<PointerEvent>) => handlers.onLeave(id, e), [handlers, id]);
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => handlers.onClick(id, e), [handlers, id]);

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
          raycast={pickable ? meshRaycast : noRaycast}
          onPointerOver={handleHover}
          onPointerMove={handleHover}
          onPointerOut={handleLeave}
          onClick={handleClick}
          visible={false}
        >
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
