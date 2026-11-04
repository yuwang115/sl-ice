/**
 * Loads the flowline catalog for the explorer, with an error state and retry.
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchFlowlineCatalog } from '../../lib/explorer-data';
import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

export type CatalogStatus = 'loading' | 'ready' | 'error';

interface CatalogSnapshot {
  readonly status: CatalogStatus;
  readonly entries: FlowlineCatalogEntry[];
  readonly error: string | null;
}

export interface FlowlineCatalogState extends CatalogSnapshot {
  readonly retry: () => void;
}

const LOADING: CatalogSnapshot = { status: 'loading', entries: [], error: null };

export function useFlowlineCatalog(): FlowlineCatalogState {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(LOADING);

  useEffect(() => {
    const controller = new AbortController();

    fetchFlowlineCatalog(controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) setSnapshot({ status: 'ready', entries, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Failed to load flow line catalog:', error);
        setSnapshot({
          status: 'error',
          entries: [],
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setSnapshot(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...snapshot, retry };
}
