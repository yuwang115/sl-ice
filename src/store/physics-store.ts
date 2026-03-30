/**
 * Physics state store — receives state updates from the Web Worker.
 */

import { create } from 'zustand';
import type { PhysicsStatePayload, GameEvent, ScenarioConfig, UserParams } from '../engine/types';

interface PhysicsStore {
  // Worker reference
  worker: Worker | null;
  isInitialized: boolean;
  isWorkerBusy: boolean;

  // Current physics state
  state: PhysicsStatePayload | null;
  events: GameEvent[];

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
        set({
          state: msg.payload,
          events: msg.payload.events || [],
          isWorkerBusy: false,
        });
      }
    };

    worker.onerror = (err) => {
      set({ isWorkerBusy: false });
      console.error('Physics worker error:', err.message, err.filename, err.lineno);
    };

    set({ worker, isInitialized: false, isWorkerBusy: false });
  },

  loadScenario: (config: ScenarioConfig) => {
    const { worker } = get();
    if (!worker) return;

    set({ scenario: config, isWorkerBusy: true });
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
    const { worker, isInitialized, isWorkerBusy } = get();
    if (!worker || !isInitialized || isWorkerBusy) return false;

    set({ isWorkerBusy: true });
    worker.postMessage({
      type: 'step',
      payload: { dt, nSteps },
    });
    return true;
  },

  reset: () => {
    const { worker, scenario } = get();
    if (!worker || !scenario) return;

    set({ isWorkerBusy: true });
    worker.postMessage({ type: 'reset', payload: {} });
  },

  destroyWorker: () => {
    const { worker } = get();
    if (worker) {
      worker.terminate();
      set({ worker: null, isInitialized: false, isWorkerBusy: false, state: null });
    }
  },
}));
