/**
 * Shown when the 3D explorer fails to load or crashes; offers the 2D sandbox.
 */

import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';

export default function ExplorerFallback() {
  const isZh = useUIStore((s) => s.language === 'zh');
  const setMode = useGameStore((s) => s.setMode);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center"
      style={{ color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
    >
      <h2 className="text-lg font-medium">
        {isZh ? '3D 探索器无法加载' : 'The 3D explorer could not be loaded'}
      </h2>
      <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
        {isZh
          ? '可能是网络不稳定，或浏览器不支持 WebGL。二维冰盖模拟仍可在沙盒模式中使用。'
          : 'This can happen on an unstable connection or without WebGL support. The 2D ice-sheet simulation still works in the sandbox.'}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setMode('sandbox')} className="pill-btn active text-sm px-4 py-2">
          {isZh ? '打开沙盒' : 'Open the sandbox'}
        </button>
        <button type="button" onClick={() => window.location.reload()} className="pill-btn text-sm px-4 py-2">
          {isZh ? '重新加载' : 'Reload'}
        </button>
      </div>
    </div>
  );
}
