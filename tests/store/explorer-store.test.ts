import { afterEach, describe, expect, it } from 'vitest';

import { useExplorerStore } from '../../src/store/explorer-store';

afterEach(() => {
  useExplorerStore.getState().reset();
});

describe('useExplorerStore', () => {
  it('keeps the velocity overlay hidden by default, including after reset', () => {
    expect(useExplorerStore.getState().showVelocity).toBe(false);

    useExplorerStore.getState().toggleLayer('velocity');
    expect(useExplorerStore.getState().showVelocity).toBe(true);

    useExplorerStore.getState().reset();
    expect(useExplorerStore.getState().showVelocity).toBe(false);
  });
});
