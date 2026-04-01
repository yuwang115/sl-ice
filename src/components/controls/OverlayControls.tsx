/**
 * Overlay visualization toggle buttons for internal ice flow.
 */

import { useUIStore, type OverlayMode } from '../../store/ui-store';
import { usePhysicsStore } from '../../store/physics-store';

const overlays: { key: OverlayMode; label: string; labelZh: string }[] = [
  { key: 'strain', label: 'Strain', labelZh: '\u5e94\u53d8' },
  { key: 'profiles', label: 'Profiles', labelZh: '\u5256\u9762' },
  { key: 'isochrones', label: 'Isochrones', labelZh: '\u7b49\u65f6\u7ebf' },
  { key: 'tracers', label: 'Tracers', labelZh: '\u793a\u8e2a' },
];

export default function OverlayControls() {
  const { overlayMode, setOverlayMode, language } = useUIStore();
  const setOverlayFlags = usePhysicsStore((s) => s.setOverlayFlags);
  const isZh = language === 'zh';

  const handleToggle = (key: OverlayMode) => {
    const next = overlayMode === key ? 'none' : key;
    setOverlayMode(next);
    setOverlayFlags(next !== 'none');
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className="text-[10px] mr-0.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {isZh ? '\u53e0\u52a0\u5c42' : 'Overlay'}
      </span>
      {overlays.map(({ key, label, labelZh }) => (
        <button
          key={key}
          onClick={() => handleToggle(key)}
          className={`pill-btn text-[10px] px-2 ${overlayMode === key ? 'active' : ''}`}
        >
          {isZh ? labelZh : label}
        </button>
      ))}
    </div>
  );
}
