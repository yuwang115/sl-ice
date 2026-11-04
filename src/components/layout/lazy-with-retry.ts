/**
 * Recovery for lazily imported chunks. React.lazy caches a rejected import,
 * so an ErrorBoundary reset alone can never recover it. Instead the import is
 * retried once; if that fails too the page reloads once (a new deployment may
 * have replaced the chunk). After that the error reaches the ErrorBoundary.
 */

const RELOAD_FLAG_KEY = 'sl-ice-chunk-reload';
const RETRY_DELAY_MS = 500;

function hasReloadedForChunk(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG_KEY) === '1';
  } catch {
    return true; // No storage: cannot guard against a reload loop, so do not reload.
  }
}

function setReloadedForChunk(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
    else sessionStorage.removeItem(RELOAD_FLAG_KEY);
  } catch {
    // Storage unavailable; hasReloadedForChunk() already reports true.
  }
}

export function lazyWithRetry<T>(
  factory: () => Promise<T>,
  reload: () => void = () => window.location.reload(),
): () => Promise<T> {
  return async () => {
    try {
      const loaded = await factory();
      setReloadedForChunk(false);
      return loaded;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    try {
      const loaded = await factory();
      setReloadedForChunk(false);
      return loaded;
    } catch (err: unknown) {
      if (hasReloadedForChunk()) throw err;
      setReloadedForChunk(true);
      reload();
      // Keep Suspense showing its fallback while the page reloads.
      return new Promise<T>(() => {});
    }
  };
}
