/**
 * Web Worker entry point for the ice sheet physics engine.
 *
 * Receives commands from the main thread and runs physics simulation
 * independently, posting state updates back.
 *
 * init, reset and step each get exactly one reply (a state_update, or an
 * error when the command cannot complete), so the main thread's busy flag
 * cannot get stuck. Every reply carries the epoch of the last init/reset,
 * which lets the main thread drop replies that belong to a previous scenario.
 */

import { initializeModel, stepPhysics, extractStatePayload } from './physics';
import type {
  PhysicsCommand, PhysicsWorkerMessage, ModelState, ScenarioConfig, GameEvent, UserParams,
} from './types';

type CommandPayload = PhysicsCommand['payload'];

let modelState: ModelState | null = null;
let scenarioConfig: ScenarioConfig | null = null;
let sendOverlayData = false;
let epoch = 0;

function post(message: PhysicsWorkerMessage): void {
  self.postMessage(message);
}

/** Post the model state; attaches the 2D velocity field when overlays are active. */
function postState(state: ModelState, events: GameEvent[]): void {
  const payload = extractStatePayload(state);
  payload.events = events;
  if (sendOverlayData) {
    payload.u_2d = new Float64Array(state.u);
  }
  post({ type: 'state_update', payload, epoch });
}

function postError(command: PhysicsCommand['type'], err: unknown): void {
  post({
    type: 'error',
    payload: {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      command,
      initialized: modelState !== null,
    },
    epoch,
  });
}

function applyOverlayFlags(flags: CommandPayload['overlayFlags']): void {
  if (flags !== undefined) {
    sendOverlayData = flags.send2DField;
  }
}

/** Fresh model for `config`, with the user's params applied over the scenario defaults. */
function createModel(config: ScenarioConfig, params: UserParams | undefined): ModelState {
  const state = initializeModel(config);
  if (params) {
    state.params = { ...state.params, ...params };
    // The initial velocity was solved under the default forcing.
    state.velocity_stale = true;
  }
  return state;
}

function handleInit(payload: CommandPayload): void {
  try {
    if (!payload.scenario) throw new Error('init requires a scenario config');
    scenarioConfig = payload.scenario;
    modelState = createModel(payload.scenario, payload.params);
    postState(modelState, []);
  } catch (err: unknown) {
    modelState = null;
    scenarioConfig = null;
    postError('init', err);
  }
}

function handleReset(payload: CommandPayload): void {
  try {
    if (!scenarioConfig) throw new Error('reset before init');
    modelState = createModel(scenarioConfig, payload.params);
    postState(modelState, []);
  } catch (err: unknown) {
    modelState = null;
    postError('reset', err);
  }
}

function handleStep(payload: CommandPayload): void {
  if (!modelState || !scenarioConfig) {
    postError('step', new Error('step before init'));
    return;
  }

  const dt = payload.dt || 1.0;
  const nSteps = payload.nSteps || 1;
  const events: GameEvent[] = [];
  let state = modelState;

  try {
    for (let i = 0; i < nSteps; i++) {
      const result = stepPhysics(state, scenarioConfig, dt);
      state = result.state;
      events.push(...result.events);
    }
    modelState = state;
    postState(state, events);
  } catch (err: unknown) {
    modelState = state;
    postError('step', err);
  }
}

function handleUpdateParams(payload: CommandPayload): void {
  // Overlay flags may arrive before the first init (persisted overlay mode).
  applyOverlayFlags(payload.overlayFlags);
  if (!modelState || !payload.params) return;
  modelState.params = { ...modelState.params, ...payload.params };
  // Forcing changed: the cached end-of-step velocity no longer applies.
  modelState.velocity_stale = true;
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = (event: MessageEvent<PhysicsCommand>) => {
  const { type, payload } = event.data;

  if (type === 'init' || type === 'reset') {
    epoch = payload.epoch ?? epoch;
    applyOverlayFlags(payload.overlayFlags);
  }

  switch (type) {
    case 'init':
      handleInit(payload);
      break;
    case 'reset':
      handleReset(payload);
      break;
    case 'step':
      handleStep(payload);
      break;
    case 'update_params':
      handleUpdateParams(payload);
      break;
    default:
      console.warn('Worker: unknown command', type);
  }
};
