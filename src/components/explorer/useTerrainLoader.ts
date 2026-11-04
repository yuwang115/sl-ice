/**
 * Starts the terrain load (fetch → worker → store) unless the terrain is
 * already cached from a previous explorer visit.
 *
 * Call it from the top of the explorer so the ~5 MB of grids download in
 * parallel with the flowline catalog. Unmounting aborts the downloads and
 * terminates the worker; an unfinished load returns to 'idle' so the next
 * visit starts cleanly. `retryLoading()` re-runs the effect.
 */

import { useEffect } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import { loadTerrain, TerrainLoadError } from '../../lib/terrain/terrain-loader';

export function useTerrainLoader(): void {
  const loadAttempt = useExplorerStore((s) => s.loadAttempt);

  useEffect(() => {
    const store = useExplorerStore.getState();
    if (store.terrain) return undefined;

    const controller = new AbortController();
    store.beginLoading();

    loadTerrain({
      signal: controller.signal,
      onProgress: (progress, step) => {
        if (!controller.signal.aborted) useExplorerStore.getState().setLoadingProgress(progress, step);
      },
    })
      .then((terrain) => {
        if (!controller.signal.aborted) useExplorerStore.getState().setTerrain(terrain);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[explorer] terrain load failed:', error);
        useExplorerStore.getState().setLoadError({
          kind: error instanceof TerrainLoadError ? error.kind : 'build',
          detail: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      controller.abort();
      useExplorerStore.getState().resetLoading();
    };
  }, [loadAttempt]);
}
