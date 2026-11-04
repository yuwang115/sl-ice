/**
 * Shared double-click detection for a set of clickable items.
 *
 * One record is kept for all items, so A → B → A within the window is three
 * single clicks (a per-item timer would wrongly treat the second A as a
 * double-click). A detected double-click consumes the record, so a triple
 * click does not fire twice.
 */

export const DOUBLE_CLICK_WINDOW_MS = 500;

export interface DoubleClickTracker {
  /** Record a click on `id` at time `now` (ms); returns true for a double-click. */
  register: (id: string, now: number) => boolean;
  reset: () => void;
}

export function createDoubleClickTracker(windowMs: number = DOUBLE_CLICK_WINDOW_MS): DoubleClickTracker {
  let last: { readonly id: string; readonly time: number } | null = null;

  return {
    register: (id, now) => {
      const isDouble = last !== null && last.id === id && now - last.time < windowMs && now >= last.time;
      last = isDouble ? null : { id, time: now };
      return isDouble;
    },
    reset: () => {
      last = null;
    },
  };
}
