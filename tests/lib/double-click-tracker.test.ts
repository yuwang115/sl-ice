import { describe, expect, it } from 'vitest';

import { createDoubleClickTracker, DOUBLE_CLICK_WINDOW_MS } from '../../src/lib/double-click-tracker';

describe('createDoubleClickTracker', () => {
  it('detects two clicks on the same line within the window', () => {
    const tracker = createDoubleClickTracker();
    expect(tracker.register('A', 0)).toBe(false);
    expect(tracker.register('A', 200)).toBe(true);
  });

  it('does not treat A → B → A as a double-click on A', () => {
    const tracker = createDoubleClickTracker();
    expect(tracker.register('A', 0)).toBe(false);
    expect(tracker.register('B', 150)).toBe(false);
    expect(tracker.register('A', 300)).toBe(false);
  });

  it('ignores clicks outside the window', () => {
    const tracker = createDoubleClickTracker();
    expect(tracker.register('A', 0)).toBe(false);
    expect(tracker.register('A', DOUBLE_CLICK_WINDOW_MS + 1)).toBe(false);
  });

  it('fires once for a triple click', () => {
    const tracker = createDoubleClickTracker();
    expect(tracker.register('A', 0)).toBe(false);
    expect(tracker.register('A', 100)).toBe(true);
    expect(tracker.register('A', 200)).toBe(false);
  });

  it('can be reset', () => {
    const tracker = createDoubleClickTracker();
    tracker.register('A', 0);
    tracker.reset();
    expect(tracker.register('A', 100)).toBe(false);
  });
});
