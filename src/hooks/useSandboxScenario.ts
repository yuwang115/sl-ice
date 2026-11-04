/**
 * Load the sandbox scenario whenever sandbox mode is entered.
 */

import { useCallback, useEffect, useState } from 'react';
import { useGameStore, type LocalizedMessage } from '../store/game-store';
import { usePhysicsStore } from '../store/physics-store';
import { fetchScenarioConfig, isAbortError } from '../store/scenario-config';

export const SANDBOX_SCENARIO = 'scenario_b_misi';

const SANDBOX_LOAD_ERROR: LocalizedMessage = {
  en: 'Could not load the sandbox scenario. Check your connection and retry.',
  zh: '无法加载沙盒场景。请检查网络连接后重试。',
};

/** Returns a callback that retries a failed sandbox load. */
export function useSandboxScenario(): () => void {
  const mode = useGameStore((s) => s.mode);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (mode !== 'sandbox') return;

    const controller = new AbortController();
    // Hold the previous scenario still until the sandbox replaces it.
    useGameStore.getState().setRunning(false);

    fetchScenarioConfig(SANDBOX_SCENARIO, { signal: controller.signal })
      .then((config) => {
        // A newer mode (and its scenario) may have taken over while fetching.
        if (controller.signal.aborted || useGameStore.getState().mode !== 'sandbox') return;
        usePhysicsStore.getState().loadScenario(config);
        useGameStore.getState().startSimulation();
      })
      .catch((err: unknown) => {
        if (isAbortError(err, controller.signal)) return;
        console.error('Failed to load scenario:', err);
        useGameStore.getState().setLoadError(SANDBOX_LOAD_ERROR);
      });

    return () => controller.abort();
  }, [mode, attempt]);

  return useCallback(() => {
    useGameStore.getState().setLoadError(null);
    setAttempt((n) => n + 1);
  }, []);
}
