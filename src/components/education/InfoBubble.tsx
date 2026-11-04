/**
 * Dynamic info bubble that appears during key events.
 * Auto-dismisses info/warning severity; critical requires manual close.
 */

import { useEffect, useRef } from 'react';
import { usePhysicsStore } from '../../store/physics-store';
import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';
import { triggerShake } from '../../renderer/effects/screen-shake';
import { triggerGlow } from '../../renderer/effects/pulse-glow';
import { triggerCalving } from '../../renderer/particles/calving';
import type { GameEvent, PhysicsStatePayload } from '../../engine/types';

const AUTO_DISMISS_MS: Record<string, number> = {
  info: 5000,
  warning: 8000,
};

/** Queue indicator dots shown at most (the queue itself is capped in the game store). */
const MAX_QUEUE_DOTS = 5;

/** Find the ice front position and surface elevation from physics state. */
function getIceFront(state: PhysicsStatePayload): { frontX: number; frontZ: number } {
  for (let i = state.H.length - 1; i >= 0; i--) {
    if (state.H[i] >= 50) {
      const dx = (state.gl_position * 1000) / Math.max(1, state.H.length - 1);
      return { frontX: i * dx, frontZ: state.s[i] || 0 };
    }
  }
  return { frontX: state.gl_position * 1000, frontZ: 0 };
}

/** Screen shake, glow and calving particles for dramatic events. */
function playEventEffects(event: GameEvent, state: PhysicsStatePayload | null): void {
  if (event.type === 'mici_triggered') {
    triggerShake(8, 800);
    triggerGlow('rgba(255, 140, 0', 1200);
  }
  if (event.type === 'cliff_failure' && state) {
    const { frontX, frontZ } = getIceFront(state);
    triggerCalving(frontX, frontZ, 8, true);
    triggerShake(5, 500);
  }
  if (event.type === 'misi_triggered') {
    triggerShake(6, 600);
    triggerGlow('rgba(255, 68, 68', 1000);
  }
  if (event.type === 'shelf_collapsed' && state) {
    const { frontX, frontZ } = getIceFront(state);
    triggerCalving(frontX, frontZ, 15, true);
    triggerShake(10, 1000);
    triggerGlow('rgba(255, 68, 68', 1500);
  }
}

export default function InfoBubble() {
  const pendingEvents = useGameStore((s) => s.pendingEvents);
  const dismissEvent = useGameStore((s) => s.dismissEvent);
  const isZh = useUIStore((s) => s.language === 'zh');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Queue each batch of physics events exactly once, as it arrives — not again
  // on re-render or language change. Messages are stored in both languages.
  useEffect(() => usePhysicsStore.subscribe((s, prev) => {
    if (s.events === prev.events) return;
    const { addEvent } = useGameStore.getState();
    for (const event of s.events) {
      addEvent(event);
      playEventEffects(event, s.state);
    }
  }), []);

  // Auto-dismiss timer for non-critical events
  const current = pendingEvents[0];
  const currentId = current?.id;
  const currentSeverity = current?.severity;
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!currentId || !currentSeverity) return;

    const duration = AUTO_DISMISS_MS[currentSeverity];
    if (!duration) return; // critical: no auto-dismiss

    timerRef.current = setTimeout(() => {
      dismissEvent(currentId);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentId, currentSeverity, dismissEvent]);

  if (!current) return null;

  const severityStyles: Record<string, { bg: string; border: string }> = {
    info: {
      bg: 'var(--severity-info-bg)',
      border: 'var(--severity-info-border)',
    },
    warning: {
      bg: 'var(--severity-warning-bg)',
      border: 'var(--severity-warning-border)',
    },
    critical: {
      bg: 'var(--severity-critical-bg)',
      border: 'var(--severity-critical-border)',
    },
  };

  const style = severityStyles[current.severity] || severityStyles.info;
  const autoDismissMs = AUTO_DISMISS_MS[current.severity];

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 max-w-md animate-in" role="alert" aria-live="assertive">
      <div
        className="rounded-xl overflow-hidden backdrop-blur-md"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="flex items-start gap-2 p-4 pb-3">
          <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-primary)' }}>
            {isZh ? current.message_zh : current.message_en}
          </p>
          <button
            onClick={() => dismissEvent(current.id)}
            className="flex-shrink-0 ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label={isZh ? '关闭' : 'Dismiss'}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {'✕'}
          </button>
        </div>

        {/* Event queue indicator + auto-dismiss progress */}
        <div className="px-4 pb-2 flex items-center justify-between">
          {/* Queue dots */}
          {pendingEvents.length > 1 && (
            <div className="flex items-center gap-1">
              {pendingEvents.slice(0, MAX_QUEUE_DOTS).map((evt, i) => (
                <span
                  key={evt.id}
                  className="rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: i === 0 ? 'var(--accent)' : 'transparent',
                    border: i === 0 ? 'none' : '1px solid var(--text-muted)',
                  }}
                />
              ))}
            </div>
          )}
          <div />
        </div>

        {/* Auto-dismiss progress bar */}
        {autoDismissMs && (
          <div
            key={current.id}
            className="h-[2px]"
            style={{
              background: style.border,
              animation: `progress-shrink ${autoDismissMs}ms linear forwards`,
            }}
          />
        )}
      </div>
    </div>
  );
}
