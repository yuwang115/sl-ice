/**
 * Header bar with logo, mode selector, and controls.
 */

import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';
import PlaybackControls from '../controls/PlaybackControls';
import OverlayControls from '../controls/OverlayControls';
import ThemeToggle from '../controls/ThemeToggle';
import type { GameMode } from '../../engine/types';

/* ─── SVG Icons ─────────────────────────────────────────── */
const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 12h16" />
    <path d="M4 6h16" />
    <path d="M4 18h16" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
);

export default function Header() {
  const { mode, setMode, selectFlowline, selectedFlowline, selectRegion } = useGameStore();
  const { language, toggleLanguage, toggleSidebar, theme } = useUIStore();
  const isZh = language === 'zh';

  const modes: { key: GameMode; label: string; labelZh: string }[] = [
    { key: 'sandbox', label: 'Sandbox', labelZh: '\u6c99\u76d2' },
    { key: 'challenge', label: 'Challenges', labelZh: '\u6311\u6218' },
    { key: 'real_world', label: 'Real World', labelZh: '\u771f\u5b9e\u4e16\u754c' },
  ];

  const handleModeSwitch = (target: GameMode) => {
    if (target !== 'explorer') selectFlowline(null);
    if (target !== 'real_world') selectRegion(null);
    setMode(target);
  };

  const handleBackToExplorer = () => {
    selectFlowline(null);
  };

  return (
    <header className="glass-panel border-b px-4 py-2 flex items-center justify-between" role="banner">
      {/* Left: menu + logo + optional back-to-explorer */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md hover:bg-[var(--bg-card)] transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={isZh ? '切换侧边栏' : 'Toggle sidebar'}
        >
          <MenuIcon />
        </button>
        <button onClick={() => handleModeSwitch('explorer')} className="flex items-center">
          <img
            src={theme === 'dark' ? '/SL-ICE logo dark.png' : '/SL-ICE logo light.png'}
            alt="SL-ICE"
            className="h-7 w-auto"
            draggable={false}
          />
        </button>
        {mode === 'explorer' && selectedFlowline && (
          <span className="animate-in">
            <button onClick={handleBackToExplorer} className="pill-btn text-[11px]">
              <ArrowLeftIcon />
              {isZh ? '\u8fd4\u56de\u63a2\u7d22\u5668' : 'Back to Explorer'}
            </button>
          </span>
        )}
      </div>

      {/* Center: mode tabs */}
      {mode !== 'menu' && (
        <nav className="flex items-center gap-1.5" role="navigation" aria-label="Simulation modes">
          {modes.map(({ key, label, labelZh }) => (
            <button
              key={key}
              onClick={() => handleModeSwitch(key)}
              className={`pill-btn text-[11px] ${mode === key ? 'active' : ''}`}
              aria-current={mode === key ? 'page' : undefined}
            >
              {isZh ? labelZh : label}
            </button>
          ))}
        </nav>
      )}

      {/* Right: grouped controls */}
      <div className="flex items-center gap-2">
        {mode !== 'menu' && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            {(mode !== 'explorer' || selectedFlowline) && (
              <>
                <OverlayControls />
                <div className="w-px h-4" style={{ background: 'var(--border)' }} />
              </>
            )}
            <PlaybackControls />
          </div>
        )}
        <ThemeToggle />
        <button onClick={toggleLanguage} className="pill-btn text-[11px]">
          {language === 'en' ? '\u4e2d\u6587' : 'EN'}
        </button>
      </div>
    </header>
  );
}
