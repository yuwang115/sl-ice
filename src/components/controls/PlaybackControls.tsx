/**
 * Playback controls: play/pause, speed, reset with SVG icons.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import type { ReactNode } from 'react';
import type { SimulationSpeed } from '../../engine/types';

/* ─── SVG Icons ─────────────────────────────────────────── */
const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

const ResetIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export default function PlaybackControls() {
  const { speed, setSpeed, setRunning } = useGameStore();
  const reset = usePhysicsStore((s) => s.reset);

  const speeds: { key: SimulationSpeed; label: ReactNode }[] = [
    { key: 'paused', label: <PauseIcon /> },
    { key: 'normal', label: '1\u00d7' },
    { key: 'fast', label: '2\u00d7' },
    { key: 'ultra', label: '5\u00d7' },
  ];

  return (
    <div className="flex items-center gap-1">
      {speeds.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => {
            setSpeed(key);
            setRunning(key !== 'paused');
          }}
          className={`pill-btn text-[11px] px-2.5 ${speed === key ? 'active' : ''}`}
          aria-label={key === 'paused' ? 'Pause' : `Speed ${key}`}
        >
          {label}
        </button>
      ))}

      <div className="w-px h-4 mx-1" style={{ background: 'var(--border)' }} />

      <button
        onClick={() => {
          reset();
          setSpeed('paused');
          setRunning(false);
        }}
        className="pill-btn text-[11px] px-2.5 hover:!border-[var(--accent-danger)] hover:!text-[var(--accent-danger)]"
        aria-label="Reset simulation"
      >
        <ResetIcon />
      </button>
    </div>
  );
}
