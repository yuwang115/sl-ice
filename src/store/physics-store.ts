/**
 * Physics state store — receives state updates from the Web Worker.
 *
 * Every loadScenario/reset starts a new epoch. The worker tags each reply with
 * the epoch of its last init/reset, so replies to commands sent before a
 * reload (e.g. a step still in flight) are recognised and dropped.
 */

import { create } from 'zustand';
import type {
  PhysicsStatePayload, GameEvent, ScenarioConfig, UserParams, PhysicsCommand,
  PhysicsWorkerMessage,
} from '../engine/types';
// Neither store imports this module, so these imports cannot form a cycle.
import { useGameStore } from './game-store';
import { useUIStore } from './ui-store';

const HISTORY_YEAR_EPSILON = 1e-9;

/** Beyond this many points the older half of the history is thinned to half resolution. */
export const HISTORY_MAX_POINTS = 4000;

const EMPTY_EVENTS: GameEvent[] = [];

export interface PhysicsHistoryPoint {
  year: number;
  glFluxKm3Yr: number;
  massChangeGt: number;
  glPosition: number;
}

type OptionalParamKey = {
  [K in keyof UserParams]-?: undefined extends UserParams[K] ? K : never;
}[keyof UserParams];

/**
 * Optional params the game store leaves unset are sent as explicit undefined,
 * so the worker's merge clears values left over from an earlier session.
 */
const UNSET_OPTIONAL_PARAMS: Record<OptionalParamKey, undefined> = {
  curtain_position: undefined,
  curtain_efficiency: undefined,
  enable_mici: undefined,
  mici_sensitivity: undefined,
};

function completeParams(params: UserParams): UserParams {
  return { ...UNSET_OPTIONAL_PARAMS, ...params };
}

function currentOverlayFlags(): { send2DField: boolean } {
  return { send2DField: useUIStore.getState().overlayMode !== 'none' };
}

function toHistoryPoint(payload: PhysicsStatePayload): PhysicsHistoryPoint {
  return {
    year: payload.year,
    glFluxKm3Yr: payload.gl_flux_km3_yr,
    massChangeGt: payload.mass_change_gt,
    glPosition: payload.gl_position,
  };
}

/** Halve the resolution of the older half; the first point and the recent half are kept. */
export function thinHistory(history: PhysicsHistoryPoint[]): PhysicsHistoryPoint[] {
  const splitAt = Math.floor(history.length / 2);
  const older = history.slice(0, splitAt).filter((_, i) => i % 2 === 0);
  return [...older, ...history.slice(splitAt)];
}

export function appendHistory(
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
  const next = [...history, point];
  return next.length > HISTORY_MAX_POINTS ? thinHistory(next) : next;
}

/** Store fields reset whenever a new scenario epoch begins. */
function freshSession() {
  return {
    isWorkerBusy: true,
    isInitialized: true,
    lastError: null,
    state: null,
    events: EMPTY_EVENTS,
    history: [],
  };
}

interface PhysicsStore {
  // Worker reference
  worker: Worker | null;
  isInitialized: boolean;
  isWorkerBusy: boolean;
  /** Scenario generation; worker replies tagged with another epoch are ignored. */
  epoch: number;
  /** Last worker failure, kept until dismissed or a new scenario epoch begins. */
  lastError: string | null;

  // Current physics state
  state: PhysicsStatePayload | null;
  events: GameEvent[];
  history: PhysicsHistoryPoint[];

  // Scenario
  scenario: ScenarioConfig | null;

  // Actions
  initWorker: () => void;
  /** Start `config` with the game store's params (see GameStore.paramsForScenario). */
  loadScenario: (config: ScenarioConfig) => void;
  /** Mirror the complete user parameter set to the worker. */
  updateParams: (params: UserParams) => void;
  setOverlayFlags: (send2DField: boolean) => void;
  step: (dt?: number, nSteps?: number) => boolean;
  /** Restart the current scenario, keeping the game store's current params. */
  reset: () => void;
  destroyWorker: () => void;
  clearError: () => void;
}

export const usePhysicsStore = create<PhysicsStore>((set, get) => {
  const handleWorkerMessage = (msg: PhysicsWorkerMessage) => {
    // A reply to a command sent before the latest init/reset. The worker is
    // FIFO, so the reply for the current epoch is still on its way: keep
    // isWorkerBusy set until it arrives.
    if (msg.epoch !== get().epoch) return;

    if (msg.type === 'error') {
      console.error(`Physics worker error (${msg.payload.command}):`, msg.payload.message);
      set({
        isWorkerBusy: false,
        isInitialized: msg.payload.initialized,
        lastError: msg.payload.message,
      });
      return;
    }

    const events = msg.payload.events?.length ? msg.payload.events : EMPTY_EVENTS;
    set((store) => ({
      state: msg.payload,
      events,
      history: appendHistory(store.history, msg.payload),
      isWorkerBusy: false,
    }));
  };

  const post = (command: PhysicsCommand) => get().worker?.postMessage(command);

  return {
    worker: null,
    isInitialized: false,
    isWorkerBusy: false,
    epoch: 0,
    lastError: null,
    state: null,
    events: EMPTY_EVENTS,
    history: [],
    scenario: null,

    initWorker: () => {
      const existing = get().worker;
      if (existing) existing.terminate();

      const worker = new Worker(
        new URL('../engine/worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<PhysicsWorkerMessage>) => {
        if (get().worker === worker) handleWorkerMessage(event.data);
      };

      worker.onerror = (err) => {
        if (get().worker !== worker) return;
        console.error('Physics worker error:', err.message, err.filename, err.lineno);
        set({
          isWorkerBusy: false,
          isInitialized: false,
          lastError: err.message || 'The physics worker stopped unexpectedly',
        });
      };

      set({
        worker,
        isInitialized: false,
        isWorkerBusy: false,
        lastError: null,
        state: null,
        events: EMPTY_EVENTS,
        history: [],
      });
    },

    loadScenario: (config: ScenarioConfig) => {
      if (!get().worker) return;

      const epoch = get().epoch + 1;
      set({ ...freshSession(), scenario: config, epoch });
      post({
        type: 'init',
        payload: {
          scenario: config,
          params: completeParams(useGameStore.getState().paramsForScenario(config)),
          overlayFlags: currentOverlayFlags(),
          epoch,
        },
      });
    },

    updateParams: (params: UserParams) => {
      post({ type: 'update_params', payload: { params: completeParams(params) } });
    },

    setOverlayFlags: (send2DField: boolean) => {
      post({ type: 'update_params', payload: { overlayFlags: { send2DField } } });
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

      post({ type: 'step', payload: { dt, nSteps } });
      return true;
    },

    reset: () => {
      const { worker, scenario } = get();
      if (!worker || !scenario) return;

      const epoch = get().epoch + 1;
      set({ ...freshSession(), epoch });
      post({
        type: 'reset',
        payload: {
          params: completeParams(useGameStore.getState().params),
          overlayFlags: currentOverlayFlags(),
          epoch,
        },
      });
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
          events: EMPTY_EVENTS,
          history: [],
        });
      }
    },

    clearError: () => set({ lastError: null }),
  };
});
