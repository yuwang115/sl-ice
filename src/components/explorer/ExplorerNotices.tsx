/**
 * Bilingual error states for the explorer: catalog load failure (full panel)
 * and scenario launch failure (dismissible banner over the 3D view).
 */

import type { FlowlineCatalogEntry } from '../game/FlowlineListPanel';

const retryButtonStyle = {
  background: 'rgba(56, 189, 248, 0.2)',
  borderColor: 'rgba(56, 189, 248, 0.6)',
  color: '#e0f2fe',
} as const;

interface CatalogErrorProps {
  isZh: boolean;
  detail: string | null;
  onRetry: () => void;
}

export function CatalogError({ isZh, detail, onRetry }: CatalogErrorProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center"
      style={{ background: '#0a1e32', color: 'rgba(224, 242, 254, 0.9)' }}
      role="alert"
    >
      <div className="text-sm font-medium">
        {isZh ? '无法加载冰流线目录' : 'Could not load the flowline catalog'}
      </div>
      <p className="text-xs max-w-sm" style={{ color: 'rgba(148, 200, 230, 0.85)' }}>
        {isZh ? '请检查网络连接后重试。' : 'Check your connection and try again.'}
      </p>
      {detail && <p className="text-[10px] font-mono max-w-sm text-red-300/70 break-words">{detail}</p>}
      <button onClick={onRetry} className="pill-btn px-4 py-1.5 text-xs font-medium" style={retryButtonStyle}>
        {isZh ? '重试' : 'Retry'}
      </button>
    </div>
  );
}

interface LaunchErrorBannerProps {
  isZh: boolean;
  entry: FlowlineCatalogEntry;
  detail: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function LaunchErrorBanner({ isZh, entry, detail, onRetry, onDismiss }: LaunchErrorBannerProps) {
  const name = isZh ? entry.name_zh : entry.name_en;

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-start gap-3 px-4 py-3 rounded-lg max-w-md text-left"
      style={{
        background: 'rgba(60, 10, 10, 0.9)',
        border: '1px solid rgba(248, 113, 113, 0.5)',
        color: 'rgba(254, 226, 226, 0.95)',
        backdropFilter: 'blur(8px)',
      }}
      role="alert"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">
          {isZh ? `无法加载「${name}」的模拟数据。` : `Could not load the simulation for ${name}.`}
        </p>
        <p className="text-[10px] font-mono mt-1 break-words" style={{ color: 'rgba(254, 202, 202, 0.7)' }}>
          {detail}
        </p>
      </div>
      <button onClick={onRetry} className="pill-btn px-3 py-1 text-[11px] flex-shrink-0" style={retryButtonStyle}>
        {isZh ? '重试' : 'Retry'}
      </button>
      <button
        onClick={onDismiss}
        className="text-sm leading-none px-1 flex-shrink-0"
        style={{ color: 'rgba(254, 226, 226, 0.7)' }}
        aria-label={isZh ? '关闭' : 'Dismiss'}
      >
        {'×'}
      </button>
    </div>
  );
}
