/**
 * Loads the selected flowline's scenario during the slice transition and
 * switches to the simulation once the screen is white.
 *
 * The scenario is prefetched when the transition starts and reused at
 * 'complete'. If it arrives after the white-out already faded, a short
 * camera-less transition is replayed so the switch is never a hard cut;
 * if it fails, a bilingual error is surfaced instead of silently bouncing
 * back to the explorer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { fetchScenarioConfig } from '../../lib/explorer-data';
import type { ScenarioConfig } from '../../engine/types';
import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

interface ScenarioRequest {
  readonly flowlineId: string;
  readonly promise: Promise<ScenarioConfig>;
}

export interface ScenarioLaunchError {
  readonly entry: FlowlineCatalogEntry;
  readonly detail: string;
}

export interface ScenarioLaunchState {
  readonly launchError: ScenarioLaunchError | null;
  readonly dismissLaunchError: () => void;
}

function isWhiteScreenFor(flowlineId: string): boolean {
  const s = useExplorerStore.getState();
  return s.isTransitioning
    && s.transitionFlowlineId === flowlineId
    && (s.transitionPhase === 'fade-out' || s.transitionPhase === 'complete');
}

export function useScenarioLaunch(catalog: FlowlineCatalogEntry[]): ScenarioLaunchState {
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const transitionFlowlineId = useExplorerStore((s) => s.transitionFlowlineId);
  const transitionPhase = useExplorerStore((s) => s.transitionPhase);
  const loadScenario = usePhysicsStore((s) => s.loadScenario);
  const selectFlowline = useGameStore((s) => s.selectFlowline);
  const setRunning = useGameStore((s) => s.setRunning);

  const requestRef = useRef<ScenarioRequest | null>(null);
  const mountedRef = useRef(true);
  const [launchError, setLaunchError] = useState<ScenarioLaunchError | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /** One cached request per flowline; failed requests are evicted so a retry refetches. */
  const requestFor = useCallback((entry: FlowlineCatalogEntry): Promise<ScenarioConfig> => {
    const current = requestRef.current;
    if (current?.flowlineId === entry.id) return current.promise;

    const promise = fetchScenarioConfig(entry.scenario);
    requestRef.current = { flowlineId: entry.id, promise };
    promise.catch(() => {
      if (requestRef.current?.promise === promise) requestRef.current = null;
    });
    return promise;
  }, []);

  // Prefetch as soon as the transition starts (during the camera zoom).
  useEffect(() => {
    if (!isTransitioning || !transitionFlowlineId) return;
    const entry = catalog.find((c) => c.id === transitionFlowlineId);
    if (entry) void requestFor(entry);
  }, [isTransitioning, transitionFlowlineId, catalog, requestFor]);

  // When the screen is fully white, switch to the simulation.
  useEffect(() => {
    if (transitionPhase !== 'complete' || !transitionFlowlineId) return;
    const entry = catalog.find((c) => c.id === transitionFlowlineId);
    if (!entry) return;

    requestFor(entry).then(
      (config) => {
        if (!mountedRef.current) return;
        if (isWhiteScreenFor(entry.id)) {
          setLaunchError(null);
          loadScenario(config);
          selectFlowline(entry.id);
          setRunning(true);
        } else if (!useExplorerStore.getState().isTransitioning) {
          // Arrived after the reveal: replay a short fade; its 'complete' launches at once.
          useExplorerStore.getState().startTransition(entry.id, null);
        }
      },
      (error: unknown) => {
        console.error('Scenario fetch failed:', error);
        if (!mountedRef.current) return;
        setLaunchError({ entry, detail: error instanceof Error ? error.message : String(error) });
      },
    );
  }, [transitionPhase, transitionFlowlineId, catalog, requestFor, loadScenario, selectFlowline, setRunning]);

  const dismissLaunchError = useCallback(() => setLaunchError(null), []);

  return { launchError, dismissLaunchError };
}
