import { afterEach, describe, expect, it, vi } from 'vitest';

import { useExplorerStore } from '../../src/store/explorer-store';
import type { ExplorerTerrain } from '../../src/lib/terrain/terrain-types';

afterEach(() => {
  useExplorerStore.getState().reset();
  vi.useRealTimers();
});

/** Minimal stand-in: the store treats the terrain snapshot as opaque. */
const fakeTerrain = { grid: { nx: 2, ny: 2, x0_m: 0, y0_m: 0, dx_m: 1, dy_m: -1 } } as unknown as ExplorerTerrain;

describe('useExplorerStore', () => {
  it('keeps the velocity overlay hidden by default, including after reset', () => {
    expect(useExplorerStore.getState().showVelocity).toBe(false);

    useExplorerStore.getState().toggleLayer('velocity');
    expect(useExplorerStore.getState().showVelocity).toBe(true);

    useExplorerStore.getState().reset();
    expect(useExplorerStore.getState().showVelocity).toBe(false);
  });

  it('keeps the decoded terrain when leaving the explorer, but resets the session', () => {
    const store = useExplorerStore.getState();
    store.setTerrain(fakeTerrain);
    store.setSelectedFlowline('thwaites-flowline-01');
    store.setHoveredFlowline('totten-flowline-02');
    store.setExaggeration(2);
    store.toggleLayer('velocity');

    useExplorerStore.getState().resetSession();
    const after = useExplorerStore.getState();
    expect(after.terrain).toBe(fakeTerrain);
    expect(after.loadingStage).toBe('ready');
    expect(after.selectedFlowlineId).toBeNull();
    expect(after.hoveredFlowlineId).toBeNull();
    expect(after.exaggeration).toBe(4.8);
    expect(after.showVelocity).toBe(false);
  });

  it('lets the slice transition reach its reveal after the explorer unmounts', () => {
    vi.useFakeTimers();
    useExplorerStore.getState().startTransition('thwaites-flowline-01', [1, 2, 3]);
    vi.advanceTimersByTime(1600);
    expect(useExplorerStore.getState().transitionPhase).toBe('complete');

    // The explorer unmounts as the simulation view takes over.
    useExplorerStore.getState().resetSession();
    vi.advanceTimersByTime(300);
    expect(useExplorerStore.getState().transitionPhase).toBe('reveal');
    vi.advanceTimersByTime(700);
    expect(useExplorerStore.getState().isTransitioning).toBe(false);
    expect(useExplorerStore.getState().transitionPhase).toBe('idle');
  });

  it('never moves the loading progress backwards within one attempt', () => {
    const store = useExplorerStore.getState();
    store.beginLoading();
    store.setLoadingProgress(0.3, 'decode');
    store.setLoadingProgress(0.1, 'bedrock');
    expect(useExplorerStore.getState().loadingProgress).toBe(0.3);
    expect(useExplorerStore.getState().loadingStep).toBe('bedrock');
  });

  it('retries a failed load and returns unfinished loads to idle', () => {
    const store = useExplorerStore.getState();
    store.beginLoading();
    store.setLoadError({ kind: 'network', detail: 'HTTP 404' });
    expect(useExplorerStore.getState().loadingStage).toBe('error');

    const attempt = useExplorerStore.getState().loadAttempt;
    useExplorerStore.getState().retryLoading();
    expect(useExplorerStore.getState().loadAttempt).toBe(attempt + 1);
    expect(useExplorerStore.getState().loadError).toBeNull();

    useExplorerStore.getState().beginLoading();
    useExplorerStore.getState().resetLoading();
    expect(useExplorerStore.getState().loadingStage).toBe('idle');
  });

  it('does not discard cached terrain on resetLoading', () => {
    useExplorerStore.getState().setTerrain(fakeTerrain);
    useExplorerStore.getState().resetLoading();
    expect(useExplorerStore.getState().loadingStage).toBe('ready');
    expect(useExplorerStore.getState().terrain).toBe(fakeTerrain);
  });
});
