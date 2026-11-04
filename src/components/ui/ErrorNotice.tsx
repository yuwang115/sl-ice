/**
 * Inline bilingual error message with optional retry and dismiss actions.
 */

import { useUIStore } from '../../store/ui-store';
import type { LocalizedMessage } from '../../store/game-store';

interface ErrorNoticeProps {
  message: LocalizedMessage;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorNotice({ message, onRetry, onDismiss, className = '' }: ErrorNoticeProps) {
  const isZh = useUIStore((s) => s.language === 'zh');

  return (
    <div
      role="alert"
      className={`glass-panel rounded-lg px-3 py-2 flex items-center gap-3 text-xs ${className}`}
      style={{ borderLeft: '3px solid var(--accent-danger)', color: 'var(--text-primary)' }}
    >
      <span className="flex-1 text-left">{isZh ? message.zh : message.en}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="pill-btn text-[11px]">
          {isZh ? '重试' : 'Retry'}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ color: 'var(--text-muted)' }}
          aria-label={isZh ? '关闭' : 'Dismiss'}
        >
          {'✕'}
        </button>
      )}
    </div>
  );
}
