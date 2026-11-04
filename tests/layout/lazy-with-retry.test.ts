import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lazyWithRetry } from '../../src/components/layout/lazy-with-retry';

const chunkError = () => new TypeError('Failed to fetch dynamically imported module');

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lazyWithRetry', () => {
  it('retries a failed import once', async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValueOnce({ default: 'Explorer' });
    const reload = vi.fn();

    const pending = lazyWithRetry(factory, reload)();
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ default: 'Explorer' });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads the page once when the retry fails too, then gives up', async () => {
    const factory = vi.fn().mockRejectedValue(chunkError());
    const reload = vi.fn();

    void lazyWithRetry(factory, reload)();
    await vi.runAllTimersAsync();
    expect(reload).toHaveBeenCalledTimes(1);

    // After the reload the flag is set, so the error reaches the ErrorBoundary.
    const afterReload = lazyWithRetry(factory, reload)();
    const outcome = expect(afterReload).rejects.toThrow(/dynamically imported module/);
    await vi.runAllTimersAsync();
    await outcome;
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
