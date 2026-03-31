/**
 * Header bar with logo, mode selector, and controls.
 */

import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';
import PlaybackControls from '../controls/PlaybackControls';
import ThemeToggle from '../controls/ThemeToggle';
import type { GameMode } from '../../engine/types';

export default function Header() {
  const { mode, setMode, selectFlowline, selectedFlowline, selectRegion } = useGameStore();
  const { language, toggleLanguage, toggleSidebar, theme } = useUIStore();
  const isZh = language === 'zh';

  const modes: { key: GameMode; label: string; labelZh: string }[] = [
    { key: 'sandbox', label: 'Sandbox', labelZh: '\u6c99\u76d2' },
    { key: 'challenge', label: 'Challenges', labelZh: '\u6311\u6218' },
    { key: 'real_world', label: 'Real World', labelZh: '\u771f\u5b9e\u4e16\u754c' },
  ];

  /** Switch mode and clean up sub-selections */
  const handleModeSwitch = (target: GameMode) => {
    if (target !== 'explorer') selectFlowline(null);
    if (target !== 'real_world') selectRegion(null);
    setMode(target);
  };

  /** For explorer simulation view: go back to the explorer list */
  const handleBackToExplorer = () => {
    selectFlowline(null);
    // mode stays 'explorer' → AntarcticaExplorer will render
  };

  return (
    <header className="glass-panel border-b px-4 py-2 flex items-center justify-between" role="banner">
      {/* Left: menu + logo + optional back-to-explorer */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="hover:text-[var(--text-primary)] transition-colors text-lg"
          style={{ color: 'var(--text-secondary)' }}
        >
          &#x2261;
        </button>
        <button onClick={() => handleModeSwitch('explorer')} className="flex items-center">
          <img
            src={theme === 'dark' ? '/SL-ICE logo dark.png' : '/SL-ICE logo light.png'}
            alt="SL-ICE"
            className="h-7 w-auto"
            draggable={false}
          />
        </button>
        {/* Back-to-explorer button when simulating a selected flowline */}
        {mode === 'explorer' && selectedFlowline && (
          <button onClick={handleBackToExplorer} className="pill-btn text-[11px]">
            {'\u2190'} {isZh ? '\u8fd4\u56de\u63a2\u7d22\u5668' : 'Back to Explorer'}
          </button>
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

      {/* Right: playback + theme + language */}
      <div className="flex items-center gap-2">
        {mode !== 'menu' && <PlaybackControls />}
        <ThemeToggle />
        <button onClick={toggleLanguage} className="pill-btn text-[11px]">
          {language === 'en' ? '\u4e2d\u6587' : 'EN'}
        </button>
      </div>
    </header>
  );
}
