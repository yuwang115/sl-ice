/**
 * Main Ice Sheet Canvas — renders the simulation visualization.
 *
 * - Sizing: one capped device-pixel ratio sizes the backing store and scales
 *   the drawing, following container resizes (ResizeObserver) and DPR changes.
 * - Loop: re-armed before drawing and guarded, so a throwing frame cannot
 *   freeze the view; passes real frame time to the particle systems; drops to
 *   ~30 fps while the simulation is paused.
 * - Input: penguin drags use pointer capture, and end on release anywhere.
 */

import { useRef, useEffect, useCallback } from 'react';
import { usePhysicsStore } from '../store/physics-store';
import { useGameStore } from '../store/game-store';
import { useUIStore, type OverlayMode } from '../store/ui-store';
import { resetSnowfall } from './particles/snowfall';
import { resetWaterFlow } from './particles/water-flow';
import { resetOceanCurrent } from './particles/ocean-current';
import { resetCalving } from './particles/calving';
import {
  resetPenguins, hasDraggedPenguin,
  handlePenguinMouseDown, handlePenguinMouseMove, handlePenguinMouseUp,
  handlePenguinClick, handlePenguinDoubleClick, penguinCursorState,
} from './particles/penguins';
import { resetTracerParticles } from './draw-internal-flow';
import { clearPreparedCache, type HoverPosition } from './draw-canvas-tooltips';
import { invalidateTextLayoutOnFontLoad } from './canvas-text';
import { computeCanvasSize, sameCanvasSize, watchDevicePixelRatio, type CanvasSize } from './canvas-sizing';
import { normalizeFrameDelta, PAUSED_FRAME_INTERVAL_MS, REFERENCE_FRAME_S, shouldRenderFrame } from './frame-timing';
import { resetFrameGeometryCache } from './frame-geometry';
import { createStaticLayerCache } from './static-layer-cache';
import { createFrameRendererState, renderFrame, type FrameRendererState } from './render-frame';

type PhysicsSnapshot = ReturnType<typeof usePhysicsStore.getState>;

/** Paused (or nothing to simulate) and no penguin being dragged → throttle the loop. */
function isSimulationIdle(hasState: boolean): boolean {
  if (!hasState) return true;
  const { isRunning, stepsPerFrame } = useGameStore.getState();
  return (!isRunning || stepsPerFrame === 0) && !hasDraggedPenguin();
}

/** Recover from an exception mid-frame: drop the save stack, clip and transform. */
function resetCanvasContext(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx && typeof ctx.reset === 'function') {
    ctx.reset();
    return;
  }
  // Re-assigning the size resets the bitmap and all context state.
  const { width } = canvas;
  canvas.width = width;
}

function resetParticleSystems(): void {
  resetSnowfall();
  resetWaterFlow();
  resetOceanCurrent();
  resetCalving();
  resetTracerParticles();
  resetPenguins();
}

export default function IceSheetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef<CanvasSize | null>(null);
  const physicsStateRef = useRef<PhysicsSnapshot['state']>(null);
  const scenarioRef = useRef<PhysicsSnapshot['scenario']>(null);
  const paramsRef = useRef(useGameStore.getState().params);
  const overlayModeRef = useRef<OverlayMode>('none');
  const hoverRef = useRef<HoverPosition | null>(null);
  const languageRef = useRef<'en' | 'zh'>('en');
  const showTooltipsRef = useRef(true);
  const frameStateRef = useRef<FrameRendererState | null>(null);

  const physicsState = usePhysicsStore((s) => s.state);
  const scenario = usePhysicsStore((s) => s.scenario);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);
  const overlayMode = useUIStore((s) => s.overlayMode);
  const language = useUIStore((s) => s.language);
  const showCanvasTooltips = useUIStore((s) => s.showCanvasTooltips);
  const params = useGameStore((s) => s.params);

  useEffect(() => {
    physicsStateRef.current = physicsState;
  }, [physicsState]);

  useEffect(() => {
    scenarioRef.current = scenario;
    // Reset penguins when scenario changes so they respawn on new ice
    resetPenguins();
    if (frameStateRef.current) frameStateRef.current.penguinsSpawned = false;
  }, [scenario]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    overlayModeRef.current = overlayMode;
  }, [overlayMode]);

  useEffect(() => {
    if (languageRef.current !== language) {
      clearPreparedCache();
    }
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    showTooltipsRef.current = showCanvasTooltips;
  }, [showCanvasTooltips]);

  // Layouts measured before the web fonts arrived must be re-measured.
  useEffect(() => invalidateTextLayoutOnFontLoad(), []);

  // Helper: update canvas cursor style directly (avoids React re-render)
  const syncCursor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cur = penguinCursorState !== 'default' ? penguinCursorState : 'default';
    if (canvas.style.cursor !== cur) canvas.style.cursor = cur;
  }, []);

  const toCanvasPoint = useCallback((clientX: number, clientY: number): HoverPosition | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  /** Drop a dragged penguin (no-op when none is being dragged). */
  const endPenguinDrag = useCallback(() => {
    if (!hasDraggedPenguin()) return;
    handlePenguinMouseUp();
    syncCursor();
  }, [syncCursor]);

  // Pointer tracking (refs only — no React re-renders)
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(e.clientX, e.clientY);
    if (!point) return;
    hoverRef.current = point;
    handlePenguinMouseMove(point.x, point.y);
    syncCursor();
  }, [syncCursor, toCanvasPoint]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    hoverRef.current = null;
    // With pointer capture the drag continues outside the canvas; without it, end it here.
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) endPenguinDrag();
  }, [endPenguinDrag]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const point = toCanvasPoint(e.clientX, e.clientY);
    if (!point) return;
    if (handlePenguinMouseDown(point.x, point.y)) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best effort; the window listeners below still end the drag.
      }
    }
    syncCursor();
  }, [syncCursor, toCanvasPoint]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(e.clientX, e.clientY);
    if (point) handlePenguinClick(point.x, point.y);
  }, [toCanvasPoint]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(e.clientX, e.clientY);
    if (point) handlePenguinDoubleClick(point.x, point.y);
  }, [toCanvasPoint]);

  // Fallback: a release anywhere (or losing focus) always ends a drag.
  useEffect(() => {
    window.addEventListener('pointerup', endPenguinDrag);
    window.addEventListener('pointercancel', endPenguinDrag);
    window.addEventListener('blur', endPenguinDrag);
    return () => {
      window.removeEventListener('pointerup', endPenguinDrag);
      window.removeEventListener('pointercancel', endPenguinDrag);
      window.removeEventListener('blur', endPenguinDrag);
    };
  }, [endPenguinDrag]);

  // Size the backing store with the same capped DPR used for drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;

    const applySize = () => {
      const size = computeCanvasSize(parent.clientWidth, parent.clientHeight, window.devicePixelRatio);
      if (sameCanvasSize(sizeRef.current, size)) return;
      sizeRef.current = size;
      canvas.width = size.pixelWidth;
      canvas.height = size.pixelHeight;
      canvas.style.width = `${size.cssWidth}px`;
      canvas.style.height = `${size.cssHeight}px`;
      setCanvasSize(size.cssWidth, size.cssHeight);
    };

    applySize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(applySize) : null;
    observer?.observe(parent);
    window.addEventListener('resize', applySize);
    const stopWatchingDpr = watchDevicePixelRatio(applySize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', applySize);
      stopWatchingDpr();
    };
  }, [setCanvasSize]);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const frameState = createFrameRendererState(createStaticLayerCache());
    frameStateRef.current = frameState;
    let frameId = 0;
    let lastDrawn: number | null = null;
    let errorLogged = false;

    const drawFrame = (dt: number) => {
      const ctx = canvas.getContext('2d');
      const size = sizeRef.current;
      if (!ctx || !size) return;
      renderFrame(ctx, {
        size,
        physicsState: physicsStateRef.current,
        scenario: scenarioRef.current,
        params: paramsRef.current,
        overlayMode: overlayModeRef.current,
        hover: hoverRef.current,
        language: languageRef.current,
        showTooltips: showTooltipsRef.current,
        dt,
      }, frameState);
    };

    const loop = (now: number) => {
      // Re-arm first: an exception below must not stop the animation for good.
      frameId = requestAnimationFrame(loop);

      const minInterval = isSimulationIdle(physicsStateRef.current !== null) ? PAUSED_FRAME_INTERVAL_MS : 0;
      if (!shouldRenderFrame(now, lastDrawn, minInterval)) return;
      const dt = lastDrawn === null ? REFERENCE_FRAME_S : normalizeFrameDelta(now - lastDrawn);
      lastDrawn = now;

      try {
        drawFrame(dt);
      } catch (error) {
        if (!errorLogged) {
          errorLogged = true;
          console.error('[IceSheetCanvas] frame render failed; continuing with the next frame', error);
        }
        resetCanvasContext(canvas);
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      frameState.staticLayers.release();
      frameStateRef.current = null;
      resetParticleSystems();
      resetFrameGeometryCache();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: '#0A1628' }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={endPenguinDrag}
      onPointerCancel={endPenguinDrag}
      onLostPointerCapture={endPenguinDrag}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
    />
  );
}
