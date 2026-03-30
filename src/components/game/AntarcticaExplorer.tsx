/**
 * 3D-ICE Explorer — the SLICE landing page.
 * Full-screen 3D Antarctica scene with flowline sidebar and welcome overlay.
 * Users "slice off a piece of Antarctica" to begin simulation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import { useExplorerStore } from '../../store/explorer-store';
import { projectFlowlinePath } from '../../lib/terrain/projection';
import FlowlineListPanel, { type FlowlineCatalogEntry } from './FlowlineListPanel';
import ThemeToggle from '../controls/ThemeToggle';
import AntarcticaScene from '../explorer/AntarcticaScene';
import type { GameMode } from '../../engine/types';

// ── Welcome Overlay (first-visit branding) ──────────────────────────

function WelcomeOverlay({ onDismiss, isZh }: { onDismiss: () => void; isZh: boolean }) {
  const theme = useUIStore((s) => s.theme);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in after a brief delay so the 3D scene renders behind
    const id = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(id);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 500); // Wait for fade-out
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(10,30,50,0.85) 0%, rgba(5,15,30,0.92) 70%)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: visible ? 'auto' : 'none',
        cursor: 'pointer',
      }}
      onClick={handleDismiss}
    >
      {/* Logo */}
      <img
        src={theme === 'dark' ? '/SL-ICE logo dark.png' : '/SL-ICE logo light.png'}
        alt="SLICE"
        className="max-w-[280px] md:max-w-[360px] h-auto mb-6"
        style={{ filter: 'drop-shadow(0 0 20px rgba(56,189,248,0.3))' }}
        draggable={false}
      />

      {/* Tagline */}
      <p
        className="text-lg md:text-xl font-light tracking-wide mb-3 text-center px-4"
        style={{ color: 'rgba(224,242,254,0.95)' }}
      >
        {isZh
          ? '切下一片南极，探索冰盖的秘密'
          : 'Slice off a piece of Antarctica and explore its secrets'}
      </p>

      {/* Subtitle */}
      <p
        className="text-sm max-w-md text-center leading-relaxed mb-8 px-4"
        style={{ color: 'rgba(148,200,230,0.75)' }}
      >
        {isZh
          ? '选择一条冰流线，模拟真实的冰川动力学过程。点击任意位置开始探索。'
          : 'Select a flowline to simulate real glacier dynamics. Click anywhere to start exploring.'}
      </p>

      {/* CTA */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        className="px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105"
        style={{
          background: 'rgba(56,189,248,0.2)',
          border: '1px solid rgba(56,189,248,0.5)',
          color: '#e0f2fe',
          backdropFilter: 'blur(8px)',
        }}
      >
        {isZh ? '开始探索' : 'Start Exploring'}
      </button>

      {/* Animated hint */}
      <div
        className="absolute bottom-8 animate-bounce text-xs"
        style={{ color: 'rgba(148,200,230,0.5)' }}
      >
        {isZh ? '点击任意位置继续' : 'Click anywhere to continue'}
      </div>
    </div>
  );
}

// ── Mode Menu Dropdown ──────────────────────────────────────────────

function ModeMenu({ isZh }: { isZh: boolean }) {
  const [open, setOpen] = useState(false);
  const setMode = useGameStore((s) => s.setMode);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const modes: { key: GameMode; label: string; labelZh: string; icon: string }[] = [
    { key: 'sandbox', label: 'Sandbox', labelZh: '沙盒模式', icon: '🧪' },
    { key: 'challenge', label: 'Challenges', labelZh: '挑战关卡', icon: '🏆' },
    { key: 'real_world', label: 'Real World', labelZh: '真实世界', icon: '🌍' },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="pill-btn text-[11px] flex items-center gap-1"
      >
        {isZh ? '更多模式' : 'More Modes'} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-44 rounded-lg overflow-hidden z-50"
          style={{
            background: 'rgba(10,30,50,0.95)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {modes.map(({ key, label, labelZh, icon }) => (
            <button
              key={key}
              onClick={() => { setMode(key); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-[12px] flex items-center gap-2 transition-colors hover:bg-white/10"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              <span>{icon}</span>
              <span>{isZh ? labelZh : label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export default function AntarcticaExplorer() {
  const { selectFlowline, setRunning } = useGameStore();
  const { loadScenario } = usePhysicsStore();
  const language = useUIStore((s) => s.language);
  const theme = useUIStore((s) => s.theme);
  const { toggleLanguage } = useUIStore();
  const isZh = language === 'zh';

  // Explorer store for bidirectional sync
  const hoveredFlowlineId = useExplorerStore((s) => s.hoveredFlowlineId);
  const selectedFlowlineId = useExplorerStore((s) => s.selectedFlowlineId);
  const setHoveredFlowline = useExplorerStore((s) => s.setHoveredFlowline);
  const setSelectedFlowline = useExplorerStore((s) => s.setSelectedFlowline);
  const startTransition = useExplorerStore((s) => s.startTransition);
  const transitionPhase = useExplorerStore((s) => s.transitionPhase);
  const transitionFlowlineId = useExplorerStore((s) => s.transitionFlowlineId);
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);
  const resetExplorer = useExplorerStore((s) => s.reset);
  const surfaceHeights = useExplorerStore((s) => s.surfaceHeights);
  const gridNx = useExplorerStore((s) => s.gridNx);
  const gridNy = useExplorerStore((s) => s.gridNy);
  const horizontalMetersPerUnit = useExplorerStore((s) => s.horizontalMetersPerUnit);
  const verticalMetersPerUnit = useExplorerStore((s) => s.verticalMetersPerUnit);

  const [catalog, setCatalog] = useState<FlowlineCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  // Pre-fetched scenario config during transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingConfigRef = useRef<any>(null);

  useEffect(() => {
    fetch('/data/flowline-catalog.json')
      .then(r => r.json())
      .then((cat: FlowlineCatalogEntry[]) => {
        setCatalog(cat);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load flow line catalog:', err);
        setLoading(false);
      });
  }, []);

  // Reset explorer state when unmounting
  useEffect(() => {
    return () => {
      resetExplorer();
    };
  }, [resetExplorer]);

  // Pre-fetch scenario JSON as soon as transition starts (during camera zoom)
  useEffect(() => {
    if (isTransitioning && transitionFlowlineId && !pendingConfigRef.current) {
      const entry = catalog.find((c) => c.id === transitionFlowlineId);
      if (entry) {
        fetch(`/data/scenarios/${entry.scenario}.json`)
          .then((r) => r.json())
          .then((config) => { pendingConfigRef.current = config; })
          .catch((err) => console.error('Pre-fetch scenario failed:', err));
      }
    }
    if (!isTransitioning) {
      pendingConfigRef.current = null;
    }
  }, [isTransitioning, transitionFlowlineId, catalog]);

  // When transition reaches 'complete', switch to simulation view instantly
  useEffect(() => {
    if (transitionPhase !== 'complete' || !transitionFlowlineId) return;

    const entry = catalog.find((c) => c.id === transitionFlowlineId);
    if (!entry) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doSwitch = (config: any) => {
      loadScenario(config);
      selectFlowline(entry.id);
      setRunning(true);
    };

    if (pendingConfigRef.current) {
      doSwitch(pendingConfigRef.current);
    } else {
      // Fallback: fetch now (should rarely happen)
      fetch(`/data/scenarios/${entry.scenario}.json`)
        .then((r) => r.json())
        .then(doSwitch)
        .catch((err) => console.error('Scenario fetch failed:', err));
    }
  }, [transitionPhase, transitionFlowlineId, catalog, loadScenario, selectFlowline, setRunning]);

  const getTransitionTargetPoint = useCallback(
    (entry: FlowlineCatalogEntry): [number, number, number] | null => {
      if (!surfaceHeights || gridNx === 0 || gridNy === 0 || entry.path_lonlat.length === 0) {
        return null;
      }

      const projectedPoints = projectFlowlinePath(
        entry.path_lonlat,
        {
          x0_m: -3_333_000,
          y0_m: 3_333_000,
          dx_m: 10_000,
          dy_m: -10_000,
          nx: gridNx,
          ny: gridNy,
        },
        horizontalMetersPerUnit,
        verticalMetersPerUnit,
        surfaceHeights,
        gridNx,
        gridNy,
      );

      return projectedPoints[Math.floor(projectedPoints.length / 2)] ?? null;
    },
    [surfaceHeights, gridNx, gridNy, horizontalMetersPerUnit, verticalMetersPerUnit],
  );

  /**
   * Trigger a transition-wrapped simulate (used by sidebar + floating button).
   * Reuses a representative point on the flowline so buttons get the same
   * camera-zoom transition as direct 3D activation.
   */
  const handleSimulateWithTransition = useCallback(
    (entry: FlowlineCatalogEntry) => {
      startTransition(entry.id, getTransitionTargetPoint(entry));
    },
    [startTransition, getTransitionTargetPoint],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <span className="animate-glow">{isZh ? '加载中...' : 'Loading...'}</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ background: '#0a1e32' }}>
      {/* Compact top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0 z-20 relative"
        style={{
          background: 'rgba(10,30,50,0.7)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Left: Logo + mode menu */}
        <div className="flex items-center gap-3">
          <img
            src={theme === 'dark' ? '/SL-ICE logo dark.png' : '/SL-ICE logo light.png'}
            alt="SLICE"
            className="h-6 w-auto"
            draggable={false}
          />
          <ModeMenu isZh={isZh} />
        </div>

        {/* Center: tagline */}
        <div className="hidden md:block text-center">
          <p className="text-[11px]" style={{ color: 'rgba(148,200,230,0.7)' }}>
            {isZh
              ? `从 ${catalog.length} 条冰流线中选择，切下一片南极进行研究`
              : `Choose from ${catalog.length} flowlines — slice off a piece of Antarctica`}
          </p>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={toggleLanguage} className="pill-btn text-[11px]">
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>
      </div>

      {/* Main content: 3D scene + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* 3D scene */}
        <div className="flex-1 min-w-0 relative">
          <AntarcticaScene catalog={catalog} onSimulate={handleSimulateWithTransition} />
        </div>

        {/* Flow line sidebar with bidirectional sync */}
        <FlowlineListPanel
          catalog={catalog}
          onSimulate={handleSimulateWithTransition}
          hoveredFlowlineId={hoveredFlowlineId}
          selectedFlowlineId={selectedFlowlineId}
          onHover={setHoveredFlowline}
          onSelect={setSelectedFlowline}
        />
      </div>

      {/* Welcome overlay (first visit) */}
      {showWelcome && (
        <WelcomeOverlay onDismiss={() => setShowWelcome(false)} isZh={isZh} />
      )}
    </div>
  );
}
