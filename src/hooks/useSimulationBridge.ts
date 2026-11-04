/**
 * Wiring between the game store and the physics worker: the step loop,
 * parameter mirroring, challenge evaluation and the event queue. Everything
 * goes through store subscriptions, so the host component does not re-render
 * on each physics tick.
 */

import { useEffect } from 'react';
import { selectActiveView, useGameStore } from '../store/game-store';
import { usePhysicsStore } from '../store/physics-store';

/** Model years advanced per physics step. */
const STEP_DT_YEARS = 0.1;

/** Step the physics each animation frame while it is running and on screen. */
function useStepLoop(): void {
  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      const game = useGameStore.getState();
      // Nothing to watch behind the explorer map, challenge list or region picker.
      if (game.isRunning && game.stepsPerFrame > 0 && selectActiveView(game) === 'simulation') {
        usePhysicsStore.getState().step(STEP_DT_YEARS, game.stepsPerFrame);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);
}

/** Mirror every parameter change to the worker (init/reset carry params themselves). */
function useParamSync(): void {
  useEffect(() => useGameStore.subscribe((s, prev) => {
    if (s.params !== prev.params) usePhysicsStore.getState().updateParams(s.params);
  }), []);
}

/** Evaluate the active challenge on every new physics state; drop stale events on reload. */
function usePhysicsStateHandlers(): void {
  useEffect(() => usePhysicsStore.subscribe((s, prev) => {
    const game = useGameStore.getState();
    if (s.epoch !== prev.epoch) game.clearEvents();
    if (s.state && s.state !== prev.state) game.evaluateChallenge(s.state);
  }), []);
}

export function useSimulationBridge(): void {
  useParamSync();
  usePhysicsStateHandlers();
  useStepLoop();
}
