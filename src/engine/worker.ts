/**
 * Web Worker entry point for the ice sheet physics engine.
 *
 * Receives commands from the main thread and runs physics simulation
 * independently, posting state updates back.
 */

import { initializeModel, stepPhysics, extractStatePayload } from './physics';
import type { PhysicsCommand, ModelState, ScenarioConfig, GameEvent } from './types';

let modelState: ModelState | null = null;
let scenarioConfig: ScenarioConfig | null = null;
let accumulatedEvents: GameEvent[] = [];

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = (event: MessageEvent<PhysicsCommand>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init': {
      if (!payload.scenario) {
        console.error('Worker: init requires scenario config');
        return;
      }
      scenarioConfig = payload.scenario;
      modelState = initializeModel(scenarioConfig);
      accumulatedEvents = [];

      // Send initial state
      const statePayload = extractStatePayload(modelState);
      statePayload.events = [];
      self.postMessage({ type: 'state_update', payload: statePayload });
      break;
    }

    case 'update_params': {
      if (!modelState) return;
      if (payload.params) {
        modelState.params = { ...modelState.params, ...payload.params };
      }
      break;
    }

    case 'step': {
      if (!modelState || !scenarioConfig) return;

      const dt = payload.dt || 1.0;
      const nSteps = payload.nSteps || 1;
      accumulatedEvents = [];

      try {
        for (let i = 0; i < nSteps; i++) {
          const result = stepPhysics(modelState, scenarioConfig, dt);
          modelState = result.state;
          accumulatedEvents.push(...result.events);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        self.postMessage({ type: 'error', payload: { message: msg, stack } });
      }

      // Send updated state
      const statePayload = extractStatePayload(modelState);
      statePayload.events = accumulatedEvents;
      self.postMessage({ type: 'state_update', payload: statePayload });
      break;
    }

    case 'reset': {
      if (!scenarioConfig) return;
      modelState = initializeModel(scenarioConfig);
      accumulatedEvents = [];

      const statePayload = extractStatePayload(modelState);
      statePayload.events = [];
      self.postMessage({ type: 'state_update', payload: statePayload });
      break;
    }

    default:
      console.warn('Worker: unknown command', type);
  }
};
