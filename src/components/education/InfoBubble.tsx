/**
 * Dynamic info bubble that appears during key events.
 */

import { useEffect } from 'react';
import { usePhysicsStore } from '../../store/physics-store';
import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';

export default function InfoBubble() {
  const events = usePhysicsStore((s) => s.events);
  const { addEvent, pendingEvents, dismissEvent } = useGameStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  useEffect(() => {
    for (const event of events) {
      addEvent({
        type: event.type,
        message: isZh ? event.message_zh : event.message_en,
        severity: event.severity,
      });
    }
  }, [events, isZh, addEvent]);

  if (pendingEvents.length === 0) return null;

  const current = pendingEvents[0];

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

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 max-w-md animate-in">
      <div
        className="rounded-xl p-4 backdrop-blur-md"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="flex items-start gap-2">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {current.message}
          </p>
          <button
            onClick={() => dismissEvent(current.id)}
            className="flex-shrink-0 ml-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {'\u2715'}
          </button>
        </div>
        {pendingEvents.length > 1 && (
          <div className="mt-2 font-data text-[10px] text-right" style={{ color: 'var(--text-muted)' }}>
            +{pendingEvents.length - 1} more
          </div>
        )}
      </div>
    </div>
  );
}
