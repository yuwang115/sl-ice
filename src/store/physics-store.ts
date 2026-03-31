/**
 * Physics state store — receives state updates from the Web Worker.
 */

import { create } from 'zustand';
import type { PhysicsStatePayload, GameEvent, ScenarioConfig, UserParams } from '../engine/types';

const HISTORY_YEAR_EPSILON = 1e-9;

export interface PhysicsHistoryPoint {
  year: number;
  glFluxKm3Yr: number;
  massChangeGt: number;
}

function toHistoryPoint(payload: PhysicsStatePayload): PhysicsHistoryPoint {
  return {
    year: payload.year,
    glFluxKm3Yr: payload.gl_flux_km3_yr,
    massChangeGt: payload.mass_change_gt,
  };
}

function appendHistory(
  history: PhysicsHistoryPoint[],
  payload: PhysicsStatePayload,
): PhysicsHistoryPoint[] {
  const point = toHistoryPoint(payload);
  const lastPoint = history[history.length - 1];

  if (!lastPoint) return [point];
  if (Math.abs(lastPoint.year - point.year) <= HISTORY_YEAR_EPSILON) {
    const next = history.slice();
    next[next.length - 1] = point;
    return next;
  }
  if (point.year < lastPoint.year) return [point];
  return [...history, point];
}

interface PhysicsStore {
  // Worker reference
  worker: Worker | null;
  isInitialized: boolean;
  isWorkerBusy: boolean;

  // Current physics state
  state: PhysicsStatePayload | null;
  events: GameEvent[];
  history: PhysicsHistoryPoint[];

  // Scenario
  scenario: ScenarioConfig | null;

  // Actions
  initWorker: () => void;
  loadScenario: (config: ScenarioConfig) => void;
  updateParams: (params: Partial<UserParams>) => void;
  step: (dt?: number, nSteps?: number) => boolean;
  reset: () => void;
  destroyWorker: () => void;
}

export const usePhysicsStore = create<PhysicsStore>((set, get) => ({
  worker: null,
  isInitialized: false,
  isWorkerBusy: false,
  state: null,
  events: [],
  history: [],
  scenario: null,

  initWorker: () => {
    const existing = get().worker;
    if (existing) existing.terminate();

    const worker = new Worker(
      new URL('../engine/worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === 'error') {
        set({ isWorkerBusy: false });
        console.error('Physics worker error:', msg.payload.message);
        return;
      }
      if (msg.type === 'state_update') {
        set((store) => ({
          state: msg.payload,
          events: msg.payload.events || [],
          history: appendHistory(store.history, msg.payload),
          isWorkerBusy: false,
        }));
      }
    };

    worker.onerror = (err) => {
      set({ isWorkerBusy: false });
      console.error('Physics worker error:', err.message, err.filename, err.lineno);
    };

    set({
      worker,
      isInitialized: false,
      isWorkerBusy: false,
      state: null,
      events: [],
      history: [],
    });
  },

  loadScenario: (config: ScenarioConfig) => {
    const { worker } = get();
    if (!worker) return;

    set({
      scenario: config,
      isWorkerBusy: true,
      state: null,
      events: [],
      history: [],
    });
    worker.postMessage({
      type: 'init',
      payload: { scenario: config },
    });
    set({ isInitialized: true });
  },

  updateParams: (params: Partial<UserParams>) => {
    const { worker } = get();
    if (!worker) return;

    worker.postMessage({
      type: 'update_params',
      payload: { params },
    });
  },

  step: (dt = 1.0, nSteps = 1) => {
    // Atomic check-and-set to prevent race condition:
    // Use a single set() call that both checks and flips the flag.
    let dispatched = false;
    set((s) => {
      if (!s.worker || !s.isInitialized || s.isWorkerBusy) return s;
      dispatched = true;
      return { ...s, isWorkerBusy: true };
    });
    if (!dispatched) return false;

    const { worker } = get();
    worker!.postMessage({
      type: 'step',
      payload: { dt, nSteps },
    });
    return true;
  },

  reset: () => {
    const { worker, scenario } = get();
    if (!worker || !scenario) return;

    set({ isWorkerBusy: true, state: null, events: [], history: [] });
    worker.postMessage({ type: 'reset', payload: {} });
  },

  destroyWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
      set({
        worker: null,
        isInitialized: false,
        isWorkerBusy: false,
        state: null,
        events: [],
        history: [],
      });
    }
  },
}));
