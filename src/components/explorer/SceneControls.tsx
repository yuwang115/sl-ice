/**
 * Overlay controls for the 3D scene — layer toggles and vertical exaggeration.
 * Positioned absolute over the Canvas.
 */

import { useExplorerStore } from '../../store/explorer-store';
import { useUIStore } from '../../store/ui-store';

export default function SceneControls() {
  const {
    showIce, showVelocity, showFlowlines, toggleLayer,
    iceOpacity, setIceOpacity,
    exaggeration, setExaggeration,
  } = useExplorerStore();
  const isZh = useUIStore((s) => s.language) === 'zh';

  return (
    <div
      className="absolute bottom-3 right-3 z-10 flex flex-col gap-2 p-3 rounded-lg text-[11px]"
      style={{
        background: 'rgba(10, 43, 67, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Layer toggles */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showIce}
            onChange={() => toggleLayer('ice')}
            className="accent-sky-400"
          />
          {isZh ? '冰层' : 'Ice'}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showVelocity}
            onChange={() => toggleLayer('velocity')}
            className="accent-sky-400"
          />
          {isZh ? '流速' : 'Velocity'}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showFlowlines}
            onChange={() => toggleLayer('flowlines')}
            className="accent-sky-400"
          />
          {isZh ? '流线' : 'Flowlines'}
        </label>
      </div>

      {/* Ice opacity slider */}
      {showIce && (
        <div className="border-t border-white/10 pt-2 mt-1">
          <div className="flex items-center justify-between mb-1">
            <span>{isZh ? '冰面透明度' : 'Ice Opacity'}</span>
            <span className="font-mono text-sky-300">{iceOpacity.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={iceOpacity}
            onChange={(e) => setIceOpacity(Number(e.target.value))}
            className="w-full accent-sky-400"
          />
        </div>
      )}

      {/* Exaggeration slider */}
      <div className="border-t border-white/10 pt-2 mt-1">
        <div className="flex items-center justify-between mb-1">
          <span>{isZh ? '垂直夸大' : 'V. Exag.'}</span>
          <span className="font-mono text-sky-300">{exaggeration.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          step={0.1}
          value={exaggeration}
          onChange={(e) => setExaggeration(Number(e.target.value))}
          className="w-full accent-sky-400"
        />
      </div>
    </div>
  );
}
