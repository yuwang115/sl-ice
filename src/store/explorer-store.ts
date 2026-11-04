/**
 * Explorer-specific state — terrain data, loading, flowline interaction, layer toggles.
 * Kept separate from game-store to avoid bloating the main simulation state.
 *
 * The decoded terrain (~60 MB of typed arrays) is a cache: it survives leaving
 * the explorer (`resetSession`) so coming back does not refetch, re-decode and
 * rebuild everything. Only `reset` drops it.
 */

import { create } from 'zustand';
import type { TerrainErrorKind } from '../lib/terrain/terrain-loader';
import type { ExplorerTerrain, TerrainLoadStep } from '../lib/terrain/terrain-types';

// ── Types ────────────────────────────────────────────────────────────

export type LoadingStage = 'idle' | 'loading' | 'ready' | 'error';

export type TransitionPhase =
  | 'idle'
  | 'camera-zoom'
  | 'slice'
  | 'fade-out'
  | 'complete'
  | 'reveal';

export interface TerrainLoadFailure {
  readonly kind: TerrainErrorKind;
  /** Technical detail (English) shown under the bilingual headline. */
  readonly detail: string;
}

export type ScenePoint = [number, number, number];

export interface ExplorerStore {
  // Terrain loading
  loadingStage: LoadingStage;
  loadingProgress: number;
  loadingStep: TerrainLoadStep | null;
  loadError: TerrainLoadFailure | null;
  /** Bumped by retryLoading() to re-run the loader effect. */
  loadAttempt: number;
  /** Decoded grids + prebuilt meshes; null until the first load completes. */
  terrain: ExplorerTerrain | null;

  // Flowline interaction
  hoveredFlowlineId: string | null;
  selectedFlowlineId: string | null;

  // Transition animation
  isTransitioning: boolean;
  transitionFlowlineId: string | null;
  transitionTargetPoint: ScenePoint | null;
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
  beginLoading: () => void;
  /** Progress only moves forward within one load attempt. */
  setLoadingProgress: (progress: number, step: TerrainLoadStep) => void;
  setTerrain: (terrain: ExplorerTerrain) => void;
  setLoadError: (failure: TerrainLoadFailure) => void;
  /** Return an unfinished load to 'idle' (no-op once terrain is cached). */
  resetLoading: () => void;
  /** Clear a load error and trigger a fresh attempt. */
  retryLoading: () => void;

  setHoveredFlowline: (id: string | null) => void;
  setSelectedFlowline: (id: string | null) => void;

  /** Start the slice transition animation toward a flowline. */
  startTransition: (flowlineId: string, targetPoint: ScenePoint | null) => void;
  setTransitionPhase: (phase: TransitionPhase) => void;

  toggleLayer: (layer: 'ice' | 'velocity' | 'flowlines') => void;
  setIceOpacity: (value: number) => void;
  setExaggeration: (value: number) => void;

  /**
   * Leaving the explorer: reset hover/selection and view settings, but keep
   * the terrain cache and let an in-flight transition finish its reveal.
   */
  resetSession: () => void;
  /** Reset everything, including the terrain cache and transition timers. */
  reset: () => void;
}

// ── Initial state ────────────────────────────────────────────────────

const initialLoadingState = {
  loadingStage: 'idle' as LoadingStage,
  loadingProgress: 0,
  loadingStep: null as TerrainLoadStep | null,
  loadError: null as TerrainLoadFailure | null,
};

const initialInteractionState = {
  hoveredFlowlineId: null as string | null,
  selectedFlowlineId: null as string | null,
};

const initialViewState = {
  showIce: true,
  showVelocity: false,
  showFlowlines: true,
  iceOpacity: 0.65,
  exaggeration: 4.8,
};

const initialTransitionState = {
  isTransitioning: false,
  transitionFlowlineId: null as string | null,
  transitionTargetPoint: null as ScenePoint | null,
  transitionPhase: 'idle' as TransitionPhase,
};

const initialState = {
  ...initialLoadingState,
  loadAttempt: 0,
  terrain: null as ExplorerTerrain | null,
  ...initialInteractionState,
  ...initialTransitionState,
  ...initialViewState,
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

  beginLoading: () => set({ ...initialLoadingState, loadingStage: 'loading' }),

  setLoadingProgress: (progress, step) =>
    set((s) => (s.loadingStage === 'loading'
      ? { loadingProgress: Math.max(s.loadingProgress, progress), loadingStep: step }
      : {})),

  setTerrain: (terrain) =>
    set({ terrain, loadingStage: 'ready', loadingProgress: 1, loadingStep: null, loadError: null }),

  setLoadError: (failure) => set({ loadingStage: 'error', loadError: failure }),

  resetLoading: () => {
    if (get().terrain) return;
    set({ ...initialLoadingState });
  },

  retryLoading: () => set((s) => ({ ...initialLoadingState, loadAttempt: s.loadAttempt + 1 })),

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
      set({ ...initialTransitionState });
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

  resetSession: () => set({ ...initialInteractionState, ...initialViewState }),

  reset: () => {
    clearTransitionTimers();
    set(initialState);
  },
}));
