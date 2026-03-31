/**
 * Explorer-specific state — terrain data, loading, flowline interaction, layer toggles.
 * Kept separate from game-store to avoid bloating the main simulation state.
 */

import { create } from 'zustand';
import type { MeshArrays, VelocityMeshArrays } from '../lib/terrain/mesh-builder';
import type { RGB } from '../lib/terrain/color-functions';

// ── Types ────────────────────────────────────────────────────────────

export type LoadingStage =
  | 'idle'
  | 'fetching'
  | 'decoding'
  | 'building'
  | 'ready'
  | 'error';

export type TransitionPhase =
  | 'idle'
  | 'camera-zoom'
  | 'slice'
  | 'fade-out'
  | 'complete'
  | 'reveal';

export interface ExplorerStore {
  // Loading
  loadingStage: LoadingStage;
  loadingProgress: number;
  loadingLabel: string;
  errorMessage: string | null;

  // Scale factors (set by worker result)
  horizontalMetersPerUnit: number;
  verticalMetersPerUnit: number;

  // Decoded grid arrays (for flowline projection & profile sampling)
  surfaceHeights: Float32Array | null;
  bedHeights: Float32Array | null;
  thicknessData: Float32Array | null;
  gridNx: number;
  gridNy: number;

  // Pre-built geometry arrays
  bedArrays: MeshArrays | null;
  iceArrays: MeshArrays | null;
  iceSideArrays: MeshArrays | null;
  iceBottomArrays: MeshArrays | null;
  velocityArrays: VelocityMeshArrays | null;

  // Color table
  bedColorTable: { ocean: RGB[]; land: RGB[] } | null;

  // Flowline interaction
  hoveredFlowlineId: string | null;
  selectedFlowlineId: string | null;

  // Transition animation
  isTransitioning: boolean;
  transitionFlowlineId: string | null;
  transitionTargetPoint: [number, number, number] | null;
  transitionPhase: TransitionPhase;

  // Layer visibility
  showIce: boolean;
  showVelocity: boolean;
  showFlowlines: boolean;

  // Ice opacity (0–1)
  iceOpacity: number;

  // Vertical exaggeration
  exaggeration: number;

  // ── Actions ──
  setLoadingStage: (stage: LoadingStage, progress: number, label?: string) => void;
  setError: (message: string) => void;

  setScaleFactors: (h: number, v: number) => void;
  setSurfaceHeights: (data: Float32Array, nx: number, ny: number) => void;
  setBedHeights: (data: Float32Array) => void;
  setThicknessData: (data: Float32Array) => void;
  setBedArrays: (arrays: MeshArrays) => void;
  setIceArrays: (arrays: MeshArrays) => void;
  setIceSideArrays: (arrays: MeshArrays) => void;
  setIceBottomArrays: (arrays: MeshArrays) => void;
  setVelocityArrays: (arrays: VelocityMeshArrays) => void;
  setBedColorTable: (table: { ocean: RGB[]; land: RGB[] }) => void;

  setHoveredFlowline: (id: string | null) => void;
  setSelectedFlowline: (id: string | null) => void;

  /** Start the slice transition animation toward a flowline. */
  startTransition: (flowlineId: string, targetPoint: [number, number, number] | null) => void;
  setTransitionPhase: (phase: TransitionPhase) => void;

  toggleLayer: (layer: 'ice' | 'velocity' | 'flowlines') => void;
  setIceOpacity: (value: number) => void;
  setExaggeration: (value: number) => void;

  /** Reset all state (when leaving explorer mode). */
  reset: () => void;
}

// ── Initial state ────────────────────────────────────────────────────

const initialState = {
  loadingStage: 'idle' as LoadingStage,
  loadingProgress: 0,
  loadingLabel: '',
  errorMessage: null as string | null,

  horizontalMetersPerUnit: 1,
  verticalMetersPerUnit: 1,

  surfaceHeights: null as Float32Array | null,
  bedHeights: null as Float32Array | null,
  thicknessData: null as Float32Array | null,
  gridNx: 0,
  gridNy: 0,

  bedArrays: null as MeshArrays | null,
  iceArrays: null as MeshArrays | null,
  iceSideArrays: null as MeshArrays | null,
  iceBottomArrays: null as MeshArrays | null,
  velocityArrays: null as VelocityMeshArrays | null,
  bedColorTable: null as { ocean: RGB[]; land: RGB[] } | null,

  hoveredFlowlineId: null as string | null,
  selectedFlowlineId: null as string | null,

  isTransitioning: false,
  transitionFlowlineId: null as string | null,
  transitionTargetPoint: null as [number, number, number] | null,
  transitionPhase: 'idle' as TransitionPhase,

  showIce: true,
  showVelocity: true,
  showFlowlines: true,

  iceOpacity: 0.65,

  exaggeration: 4.8,
};

// ── Transition timer management (module-level, outside React lifecycle) ──

let transitionTimers: ReturnType<typeof setTimeout>[] = [];

function clearTransitionTimers() {
  transitionTimers.forEach(clearTimeout);
  transitionTimers = [];
}

function schedulePhase(ms: number, action: () => void) {
  transitionTimers.push(setTimeout(action, ms));
}

// ── Store ────────────────────────────────────────────────────────────

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  ...initialState,

  setLoadingStage: (stage, progress, label) =>
    set({ loadingStage: stage, loadingProgress: progress, loadingLabel: label ?? '' }),

  setError: (message) =>
    set({ loadingStage: 'error', errorMessage: message }),

  setScaleFactors: (h, v) =>
    set({ horizontalMetersPerUnit: h, verticalMetersPerUnit: v }),

  setSurfaceHeights: (data, nx, ny) =>
    set({ surfaceHeights: data, gridNx: nx, gridNy: ny }),
  setBedHeights: (data) => set({ bedHeights: data }),
  setThicknessData: (data) => set({ thicknessData: data }),

  setBedArrays: (arrays) => set({ bedArrays: arrays }),
  setIceArrays: (arrays) => set({ iceArrays: arrays }),
  setIceSideArrays: (arrays) => set({ iceSideArrays: arrays }),
  setIceBottomArrays: (arrays) => set({ iceBottomArrays: arrays }),
  setVelocityArrays: (arrays) => set({ velocityArrays: arrays }),
  setBedColorTable: (table) => set({ bedColorTable: table }),

  setHoveredFlowline: (id) => set({ hoveredFlowlineId: id }),
  setSelectedFlowline: (id) => set({ selectedFlowlineId: id }),

  startTransition: (flowlineId, targetPoint) => {
    // Cancel any in-flight transition timers from a previous call
    clearTransitionTimers();

    const hasCamera = targetPoint !== null;
    set({
      isTransitioning: true,
      transitionFlowlineId: flowlineId,
      transitionTargetPoint: targetPoint,
      transitionPhase: hasCamera ? 'camera-zoom' : 'slice',
      selectedFlowlineId: flowlineId,
    });

    const cleanup = () => {
      clearTransitionTimers();
      set({
        isTransitioning: false,
        transitionFlowlineId: null,
        transitionTargetPoint: null,
        transitionPhase: 'idle',
      });
    };

    // Schedule phase transitions — each guarded against cancelled transitions
    if (hasCamera) {
      schedulePhase(700, () => { if (get().isTransitioning) set({ transitionPhase: 'slice' }); });
      schedulePhase(1200, () => { if (get().isTransitioning) set({ transitionPhase: 'fade-out' }); });
      schedulePhase(1600, () => { if (get().isTransitioning) set({ transitionPhase: 'complete' }); });
      schedulePhase(1900, () => { if (get().isTransitioning) set({ transitionPhase: 'reveal' }); });
      schedulePhase(2600, cleanup);
    } else {
      schedulePhase(500, () => { if (get().isTransitioning) set({ transitionPhase: 'fade-out' }); });
      schedulePhase(900, () => { if (get().isTransitioning) set({ transitionPhase: 'complete' }); });
      schedulePhase(1200, () => { if (get().isTransitioning) set({ transitionPhase: 'reveal' }); });
      schedulePhase(1900, cleanup);
    }
  },

  setTransitionPhase: (phase) => set({ transitionPhase: phase }),

  toggleLayer: (layer) =>
    set((s) => {
      switch (layer) {
        case 'ice':       return { showIce: !s.showIce };
        case 'velocity':  return { showVelocity: !s.showVelocity };
        case 'flowlines': return { showFlowlines: !s.showFlowlines };
      }
    }),

  setIceOpacity: (value) => set({ iceOpacity: value }),
  setExaggeration: (value) => set({ exaggeration: value }),

  reset: () => {
    clearTransitionTimers();
    set(initialState);
  },
}));
