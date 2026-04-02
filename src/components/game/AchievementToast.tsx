/**
 * Achievement toast notification.
 * Shows briefly when an achievement is unlocked, with educational insight.
 */

import { useEffect } from 'react';
import { useAchievementStore } from '../../store/achievement-store';
import { useUIStore } from '../../store/ui-store';

export default function AchievementToast() {
  const pending = useAchievementStore((s) => s.pending);
  const dismissToast = useAchievementStore((s) => s.dismissToast);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(dismissToast, 6000);
    return () => clearTimeout(timer);
  }, [pending, dismissToast]);

  if (!pending) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-xl px-5 py-3 flex items-start gap-3 max-w-sm"
      style={{
        animation: 'slide-in-from-top 0.4s ease-out',
        borderColor: 'var(--accent-warm)',
        borderWidth: '1px',
      }}
    >
      <span className="text-2xl flex-shrink-0 mt-0.5">{pending.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[9px] font-data uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--accent-warm)', color: 'white' }}
          >
            {isZh ? '成就解锁' : 'Achievement'}
          </span>
        </div>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isZh ? pending.name_zh : pending.name_en}
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {isZh ? pending.description_zh : pending.description_en}
        </p>
      </div>
      <button
        onClick={dismissToast}
        className="text-xs flex-shrink-0 mt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        ✕
      </button>
    </div>
  );
}
