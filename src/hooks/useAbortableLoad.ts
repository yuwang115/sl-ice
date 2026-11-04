/**
 * Run one cancellable async load at a time (e.g. fetching a scenario on click).
 * Starting a new load, calling cancel() or unmounting aborts the previous one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../store/scenario-config';

export interface AbortableLoad<K> {
  /** Key of the load in flight, or null. */
  pendingKey: K | null;
  /** Resolves true on success, false on failure (onError was called) or abort. */
  run: (
    key: K,
    task: (signal: AbortSignal) => Promise<void>,
    onError: (err: unknown) => void,
  ) => Promise<boolean>;
  cancel: () => void;
}

export function useAbortableLoad<K>(): AbortableLoad<K> {
  const [pendingKey, setPendingKey] = useState<K | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback<AbortableLoad<K>['run']>(async (key, task, onError) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPendingKey(key);
    try {
      await task(controller.signal);
      return !controller.signal.aborted;
    } catch (err: unknown) {
      if (!isAbortError(err, controller.signal)) onError(err);
      return false;
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPendingKey(null);
      }
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPendingKey(null);
  }, []);

  return { pendingKey, run, cancel };
}
