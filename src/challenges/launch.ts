/**
 * Start (or restart) a challenge: fetch its scenario, apply its parameters
 * and begin the run. Kept out of challenges/index.ts, which the game store
 * imports, so the stores never form an import cycle.
 */

import { challenges } from './index';
import { useGameStore } from '../store/game-store';
import { usePhysicsStore } from '../store/physics-store';
import { fetchScenarioConfig } from '../store/scenario-config';

/**
 * Rejects when the scenario cannot be loaded (nothing is changed then) or when
 * `signal` is aborted before the challenge starts.
 */
export async function launchChallenge(id: number, signal?: AbortSignal): Promise<void> {
  const challenge = challenges.find((c) => c.id === id);
  if (!challenge) throw new Error(`Unknown challenge ${id}`);

  const config = await fetchScenarioConfig(challenge.scenario, { signal });
  signal?.throwIfAborted();

  const game = useGameStore.getState();
  // Defaults plus this challenge's overrides: nothing carries over from earlier runs.
  game.resetParams({ enable_hydrology: challenge.enable_hydrology, ...challenge.initial_params });
  // Enter the challenge before loading, so the load keeps the challenge's params.
  game.startChallenge(id);
  usePhysicsStore.getState().loadScenario(config);
  game.startSimulation();
}

/** The first unlocked challenge after `id`, if any. */
export function nextAvailableChallenge(
  id: number,
  progress: ReadonlyArray<{ id: number; status: string }>,
): number | null {
  const next = challenges
    .map((c) => c.id)
    .filter((cid) => cid > id)
    .sort((a, b) => a - b)
    .find((cid) => progress.find((p) => p.id === cid)?.status !== 'locked');
  return next ?? null;
}
