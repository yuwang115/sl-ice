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
import type { PhysicsStatePayload } from '../../engine/types';

const AUTO_DISMISS_MS: Record<string, number> = {
  info: 5000,
  warning: 8000,
};

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

export default function InfoBubble() {
  const events = usePhysicsStore((s) => s.events);
  const { addEvent, pendingEvents, dismissEvent } = useGameStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';
  const physicsState = usePhysicsStore((s) => s.state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    for (const event of events) {
      addEvent({
        type: event.type,
        message: isZh ? event.message_zh : event.message_en,
        severity: event.severity,
      });

      if (event.type === 'mici_triggered') {
        triggerShake(8, 800);
        triggerGlow('rgba(255, 140, 0', 1200);
      }
      if (event.type === 'cliff_failure' && physicsState) {
        const { frontX, frontZ } = getIceFront(physicsState);
        triggerCalving(frontX, frontZ, 8, true);
        triggerShake(5, 500);
      }
      if (event.type === 'misi_triggered') {
        triggerShake(6, 600);
        triggerGlow('rgba(255, 68, 68', 1000);
      }
      if (event.type === 'shelf_collapsed' && physicsState) {
        const { frontX, frontZ } = getIceFront(physicsState);
        triggerCalving(frontX, frontZ, 15, true);
        triggerShake(10, 1000);
        triggerGlow('rgba(255, 68, 68', 1500);
      }
    }
  }, [events, isZh, addEvent, physicsState]);

  // Auto-dismiss timer for non-critical events
  const current = pendingEvents[0];
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!current) return;

    const duration = AUTO_DISMISS_MS[current.severity];
    if (!duration) return; // critical: no auto-dismiss

    timerRef.current = setTimeout(() => {
      dismissEvent(current.id);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, dismissEvent]);

  if (pendingEvents.length === 0 || !current) return null;

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
            {current.message}
          </p>
          <button
            onClick={() => dismissEvent(current.id)}
            className="flex-shrink-0 ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-card)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Event queue indicator + auto-dismiss progress */}
        <div className="px-4 pb-2 flex items-center justify-between">
          {/* Queue dots */}
          {pendingEvents.length > 1 && (
            <div className="flex items-center gap-1">
              {pendingEvents.slice(0, 5).map((evt, i) => (
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
              {pendingEvents.length > 5 && (
                <span className="font-data text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  +{pendingEvents.length - 5}
                </span>
              )}
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
