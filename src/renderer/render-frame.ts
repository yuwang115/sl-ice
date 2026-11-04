/**
 * One frame of the 2D simulation canvas, back to front. Split out of
 * IceSheetCanvas so the React component only handles sizing, input and the
 * animation loop.
 */

import type { PhysicsStatePayload, ScenarioConfig, UserParams } from '../engine/types';
import type { OverlayMode } from '../store/ui-store';
import type { CanvasSize } from './canvas-sizing';
import { drawBedrock, type DrawContext } from './draw-bedrock';
import { drawOcean } from './draw-ocean';
import { drawIce, drawGroundingLine } from './draw-ice';
import { drawAxes, drawCliffIndicator, drawInstabilityWarnings, drawVelocityArrows } from './draw-annotations';
import { drawSeafloorBarrier } from './draw-barrier';
import { drawSnowfall } from './particles/snowfall';
import { drawWaterFlow } from './particles/water-flow';
import { drawOceanCurrent } from './particles/ocean-current';
import { drawCalving, triggerCalving } from './particles/calving';
import { drawPenguins, spawnInitialPenguins } from './particles/penguins';
import { drawStrainRateHeatmap, drawVelocityProfiles, drawIsochrones, drawTracerParticles } from './draw-internal-flow';
import { getShakeOffset } from './effects/screen-shake';
import { drawGlow } from './effects/pulse-glow';
import { drawCanvasTooltips, type HoverPosition } from './draw-canvas-tooltips';
import { drawStatusHUD } from './draw-status-hud';
import { getFrameGeometry, type FrameGeometry } from './frame-geometry';
import type { StaticLayerCache } from './static-layer-cache';

const BACKGROUND = '#0A1628';

export interface FrameInput {
  readonly size: CanvasSize;
  readonly physicsState: PhysicsStatePayload | null;
  readonly scenario: ScenarioConfig | null;
  readonly params: UserParams;
  readonly overlayMode: OverlayMode;
  readonly hover: HoverPosition | null;
  readonly language: 'en' | 'zh';
  readonly showTooltips: boolean;
  /** Seconds since the last drawn frame (clamped). */
  readonly dt: number;
}

/** Per-canvas state that persists across frames. */
export interface FrameRendererState {
  prevIceFrontIdx: number;
  lastCalvingSpawnMs: number;
  penguinsSpawned: boolean;
  readonly staticLayers: StaticLayerCache;
}

export function createFrameRendererState(staticLayers: StaticLayerCache): FrameRendererState {
  return { prevIceFrontIdx: -1, lastCalvingSpawnMs: 0, penguinsSpawned: false, staticLayers };
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#E0E0E0';
  ctx.textAlign = 'center';
  ctx.fillText('Select a mode to begin simulation', width / 2, height / 2);
}

/** Bedrock + ice body: static for a given state, so served from the layer cache when unchanged. */
function drawStaticLayers(
  dc: DrawContext,
  state: PhysicsStatePayload,
  scenario: ScenarioConfig,
  geometry: FrameGeometry,
  size: CanvasSize,
  cache: StaticLayerCache,
): void {
  const key = { state, scenario, pixelWidth: size.pixelWidth, pixelHeight: size.pixelHeight, dpr: size.dpr };
  cache.draw(dc.ctx, key, (ctx) => {
    const layerDc: DrawContext = { ...dc, ctx };
    drawBedrock(layerDc, state.b, geometry.xPositions);
    drawIce(layerDc, state.H, state.s, state.ice_base, geometry.isFloating, geometry.xPositions, geometry.glPositionM);
  });
}

function drawFlowOverlay(dc: DrawContext, state: PhysicsStatePayload, xPositions: Float64Array, mode: OverlayMode, dt: number): void {
  if (mode === 'none' || !state.u_2d) return;
  const { u_2d, H, s, ice_base, nz, dsigma } = state;
  const nx = H.length;
  switch (mode) {
    case 'strain':
      drawStrainRateHeatmap(dc, u_2d, H, ice_base, xPositions, nx, nz, dsigma);
      break;
    case 'profiles':
      drawVelocityProfiles(dc, u_2d, H, s, ice_base, xPositions, nx, nz, dsigma);
      break;
    case 'isochrones':
      drawIsochrones(dc, u_2d, H, s, ice_base, xPositions, nx, nz, dsigma);
      break;
    case 'tracers':
      drawTracerParticles(dc, u_2d, H, s, ice_base, xPositions, nx, nz, dsigma, dt);
      break;
  }
}

function drawParticles(dc: DrawContext, input: FrameInput, state: PhysicsStatePayload, geometry: FrameGeometry, frame: FrameRendererState): void {
  const { xPositions, isFloating, glPositionM } = geometry;
  if (!frame.penguinsSpawned) {
    spawnInitialPenguins(state.s, xPositions, glPositionM);
    frame.penguinsSpawned = true;
  }
  drawPenguins(dc, state.H, state.s, state.u_surface, xPositions, glPositionM, input.dt);

  drawSnowfall(dc, state.smb, state.s, xPositions, input.params.precip_scale, input.dt);
  if (input.params.enable_hydrology) {
    drawWaterFlow(dc, state.water_pressure, state.b, state.H, xPositions, isFloating, input.dt);
  }
  drawOceanCurrent(dc, isFloating, state.b, state.H, xPositions, input.params.T_ocean_delta, input.dt);
}

/** Auto-spawn icebergs when the ice front retreats, plus occasional steady-state calving. */
function spawnCalvingAtFront(state: PhysicsStatePayload, xPositions: Float64Array, frame: FrameRendererState): void {
  const { H, s, u_surface } = state;
  let iceFrontIdx = -1;
  for (let i = H.length - 1; i >= 0; i--) {
    if (H[i] >= 50) { iceFrontIdx = i; break; }
  }
  const now = Date.now();
  if (iceFrontIdx >= 0 && frame.prevIceFrontIdx >= 0) {
    const retreated = frame.prevIceFrontIdx > iceFrontIdx;
    const hasVelocity = iceFrontIdx < u_surface.length && u_surface[iceFrontIdx] > 100;
    if (retreated && now - frame.lastCalvingSpawnMs > 800) {
      triggerCalving(xPositions[iceFrontIdx], s[iceFrontIdx], 3 + Math.floor(Math.random() * 4));
      frame.lastCalvingSpawnMs = now;
    } else if (hasVelocity && now - frame.lastCalvingSpawnMs > 2000) {
      // Steady-state calving: occasional small icebergs at the terminus
      triggerCalving(xPositions[iceFrontIdx], s[iceFrontIdx], 1 + Math.floor(Math.random() * 2));
      frame.lastCalvingSpawnMs = now;
    }
  }
  frame.prevIceFrontIdx = iceFrontIdx;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  input: FrameInput,
  state: PhysicsStatePayload,
  scenario: ScenarioConfig,
  frame: FrameRendererState,
): void {
  const { cssWidth: width, cssHeight: height } = input.size;
  const geometry = getFrameGeometry(state, scenario.domain_length);
  const { xPositions, glPositionM } = geometry;

  const shake = getShakeOffset();
  ctx.translate(shake.x, shake.y);

  const dc: DrawContext = {
    ctx, width, height,
    xMin: 0, xMax: geometry.domainLengthM, zMin: geometry.zMin, zMax: geometry.zMax,
  };

  // ── Draw layers (back to front) ──
  drawAxes(dc);
  drawOcean(dc, state.b, xPositions);
  drawStaticLayers(dc, state, scenario, geometry, input.size, frame.staticLayers);
  drawFlowOverlay(dc, state, xPositions, input.overlayMode, input.dt);
  drawGroundingLine(dc, glPositionM, state.b, xPositions);
  drawSeafloorBarrier(dc, input.params, state.b, xPositions, input.language);
  drawVelocityArrows(dc, state.u_surface, state.s, state.H, xPositions);

  drawParticles(dc, input, state, geometry, frame);
  spawnCalvingAtFront(state, xPositions, frame);
  drawCalving(dc, input.dt);

  if (state.is_mici_active) {
    drawCliffIndicator(dc, state.cliff_height, state.mici_calving_rate, state.H, state.s, state.ice_base, xPositions);
  }
  drawInstabilityWarnings(dc, input.language, state.is_misi_active, state.is_mici_active);
  drawGlow(ctx, width, height);

  if (input.showTooltips) {
    drawCanvasTooltips(dc, state, xPositions, input.hover, input.language);
    drawStatusHUD(dc, state, input.language);
  }
}

/** Render one frame; drawing coordinates are CSS pixels scaled by the capped DPR. */
export function renderFrame(ctx: CanvasRenderingContext2D, input: FrameInput, frame: FrameRendererState): void {
  const { size, physicsState, scenario } = input;
  ctx.save();
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  try {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, size.cssWidth, size.cssHeight);

    if (!physicsState || !scenario) {
      drawPlaceholder(ctx, size.cssWidth, size.cssHeight);
      return;
    }
    drawScene(ctx, input, physicsState, scenario, frame);
  } finally {
    ctx.restore();
  }
}
