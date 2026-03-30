/**
 * Loading overlay shown while terrain data is being fetched and processed.
 */

import { useExplorerStore } from '../../store/explorer-store';
import { useUIStore } from '../../store/ui-store';

export default function LoadingOverlay() {
  const { loadingStage, loadingProgress, loadingLabel, errorMessage } = useExplorerStore();
  const isZh = useUIStore((s) => s.language) === 'zh';

  if (loadingStage === 'ready') return null;

  const pct = Math.round(loadingProgress * 100);

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
      style={{ background: 'rgba(10, 43, 67, 0.92)' }}
    >
      {loadingStage === 'error' ? (
        <>
          <div className="text-red-400 text-sm font-medium">
            {isZh ? '加载失败' : 'Loading Failed'}
          </div>
          <div className="text-red-300 text-xs max-w-xs text-center">{errorMessage}</div>
        </>
      ) : (
        <>
          {/* Progress bar */}
          <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div
              className="h-full rounded-full transition-transform duration-300 ease-out origin-left"
              style={{
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                transform: `scaleX(${loadingProgress})`,
              }}
            />
          </div>

          <div className="text-center">
            <div className="text-white/80 text-xs font-medium">
              {loadingLabel || (isZh ? '正在加载地形数据...' : 'Loading terrain data...')}
            </div>
            <div className="text-white/50 text-[10px] mt-1 font-mono">{pct}%</div>
          </div>
        </>
      )}
    </div>
  );
}
