/**
 * Smoothly interpolates a number for display, avoiding jumpy counter updates.
 */

import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, duration = 300): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const delta = target - from;

    cancelAnimationFrame(rafRef.current);

    // Skip animation for negligible changes (< 0.1% of value range)
    if (Math.abs(delta) < Math.abs(target) * 0.001 && Math.abs(delta) < 0.01) {
      rafRef.current = requestAnimationFrame(() => {
        prevRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(rafRef.current);
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - (1 - progress) ** 3;
      const current = from + delta * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}
