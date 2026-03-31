/**
 * Main Ice Sheet Canvas — renders the simulation visualization.
 */

import { useRef, useEffect, useCallback } from 'react';
import { usePhysicsStore } from '../store/physics-store';
import { useGameStore } from '../store/game-store';
import { useUIStore } from '../store/ui-store';
import type { DrawContext } from './draw-bedrock';
import { drawBedrock } from './draw-bedrock';
import { drawOcean } from './draw-ocean';
import { drawIce, drawGroundingLine } from './draw-ice';
import { drawAxes, drawMISIWarning, drawMICIWarning, drawCliffIndicator, drawVelocityArrows } from './draw-annotations';
import { drawSnowfall, resetSnowfall } from './particles/snowfall';
import { drawWaterFlow, resetWaterFlow } from './particles/water-flow';
import { drawOceanCurrent, resetOceanCurrent } from './particles/ocean-current';
import { drawCalving, resetCalving, triggerCalving } from './particles/calving';
import { getShakeOffset } from './effects/screen-shake';
import { drawGlow } from './effects/pulse-glow';

export default function IceSheetCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const physicsStateRef = useRef<ReturnType<typeof usePhysicsStore.getState>['state']>(null);
  const scenarioRef = useRef<ReturnType<typeof usePhysicsStore.getState>['scenario']>(null);
  const paramsRef = useRef(useGameStore.getState().params);
  const xPositionCacheRef = useRef<{ key: string; positions: Float64Array } | null>(null);
  const prevIceFrontRef = useRef<number>(-1);
  const lastCalvingSpawnRef = useRef<number>(0);

  const physicsState = usePhysicsStore((s) => s.state);
  const scenario = usePhysicsStore((s) => s.scenario);
  const setCanvasSize = useUIStore((s) => s.setCanvasSize);
  const params = useGameStore((s) => s.params);

  useEffect(() => {
    physicsStateRef.current = physicsState;
  }, [physicsState]);

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setCanvasSize(w, h);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCanvasSize]);

  // Main render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const physicsState = physicsStateRef.current;
    const scenario = scenarioRef.current;
    const params = paramsRef.current;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.scale(dpr, dpr);

    const displayW = w / dpr;
    const displayH = h / dpr;

    // Clear with background color
    ctx.fillStyle = '#0A1628';
    ctx.fillRect(0, 0, displayW, displayH);

    if (!physicsState || !scenario) {
      // Draw placeholder
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#E0E0E0';
      ctx.textAlign = 'center';
      ctx.fillText('Select a mode to begin simulation', displayW / 2, displayH / 2);
      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
      return;
    }

    // Compute domain extents
    const domainLen = scenario.domain_length * 1000; // km to m
    const xMin = 0;
    const xMax = domainLen;

    // Find z range from data
    let zMin = -1500;
    let zMax = 4000;
    if (physicsState.b && physicsState.s) {
      let minB = 0, maxS = 0;
      for (let i = 0; i < physicsState.b.length; i++) {
        if (physicsState.b[i] < minB) minB = physicsState.b[i];
        if (physicsState.s[i] > maxS) maxS = physicsState.s[i];
      }
      zMin = minB - 200;
      zMax = Math.max(maxS + 500, 500);
    }

    // Apply screen shake
    const shake = getShakeOffset();
    ctx.translate(shake.x, shake.y);

    const dc: DrawContext = {
      ctx,
      width: displayW,
      height: displayH,
      xMin, xMax, zMin, zMax,
    };

    // Compute x positions
    const nx = physicsState.H.length;
    const cacheKey = `${domainLen}:${nx}`;
    let xPositions = xPositionCacheRef.current?.key === cacheKey
      ? xPositionCacheRef.current.positions
      : null;
    if (!xPositions) {
      xPositions = new Float64Array(nx);
      const dx = domainLen / (nx - 1);
      for (let i = 0; i < nx; i++) {
        xPositions[i] = i * dx;
      }
      xPositionCacheRef.current = { key: cacheKey, positions: xPositions };
    }

    const H = physicsState.H;
    const s = physicsState.s;
    const b = physicsState.b;
    const ice_base = physicsState.ice_base;
    const smb = physicsState.smb;
    const u_surface = physicsState.u_surface;
    const water_pressure = physicsState.water_pressure;

    // Build floating mask from physics state
    const is_floating = new Uint8Array(nx);
    const gl_pos_m = physicsState.gl_position * 1000;
    for (let i = 0; i < nx; i++) {
      is_floating[i] = xPositions[i] > gl_pos_m && H[i] > 10 ? 1 : 0;
    }

    // ── Draw layers (back to front) ──
    drawAxes(dc);
    drawOcean(dc, b, xPositions);
    drawBedrock(dc, b, xPositions);
    drawIce(dc, H, s, ice_base, is_floating, xPositions, gl_pos_m);
    drawGroundingLine(dc, gl_pos_m, b, xPositions);
    drawVelocityArrows(dc, u_surface, s, H, xPositions);

    // ── Particle systems ──
    drawSnowfall(dc, smb, s, xPositions, params.precip_scale);
    if (params.enable_hydrology) {
      drawWaterFlow(dc, water_pressure, b, H, xPositions, is_floating);
    }
    drawOceanCurrent(dc, is_floating, b, H, xPositions, params.T_ocean_delta);

    // ── Auto-spawn icebergs when ice front retreats ──
    {
      let iceFrontIdx = -1;
      for (let i = H.length - 1; i >= 0; i--) {
        if (H[i] >= 50) { iceFrontIdx = i; break; }
      }
      const now = Date.now();
      if (iceFrontIdx >= 0 && prevIceFrontRef.current >= 0) {
        const retreated = prevIceFrontRef.current > iceFrontIdx;
        const hasVelocity = iceFrontIdx < u_surface.length && u_surface[iceFrontIdx] > 100;
        if (retreated && now - lastCalvingSpawnRef.current > 800) {
          triggerCalving(xPositions[iceFrontIdx], s[iceFrontIdx], 3 + Math.floor(Math.random() * 4));
          lastCalvingSpawnRef.current = now;
        } else if (hasVelocity && now - lastCalvingSpawnRef.current > 2000) {
          // Steady-state calving: occasional small icebergs at the terminus
          triggerCalving(xPositions[iceFrontIdx], s[iceFrontIdx], 1 + Math.floor(Math.random() * 2));
          lastCalvingSpawnRef.current = now;
        }
      }
      prevIceFrontRef.current = iceFrontIdx;
    }

    drawCalving(dc);

    // ── MICI cliff indicator ──
    if (physicsState.is_mici_active) {
      drawCliffIndicator(dc, physicsState.cliff_height, physicsState.mici_calving_rate, H, s, ice_base, xPositions);
    }

    // ── Effects ──
    if (physicsState.is_misi_active) {
      drawMISIWarning(dc);
    }
    if (physicsState.is_mici_active) {
      drawMICIWarning(dc);
    }
    drawGlow(ctx, displayW, displayH);

    ctx.restore();
    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resetSnowfall();
      resetWaterFlow();
      resetOceanCurrent();
      resetCalving();
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: '#0A1628' }}
    />
  );
}
