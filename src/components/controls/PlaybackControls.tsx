/**
 * Playback controls: play/pause, speed, reset.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import type { SimulationSpeed } from '../../engine/types';

export default function PlaybackControls() {
  const { speed, setSpeed, setRunning } = useGameStore();
  const reset = usePhysicsStore((s) => s.reset);

  const speeds: { key: SimulationSpeed; label: string }[] = [
    { key: 'paused', label: '\u23f8' },
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
      >
        {'↺'}
      </button>
    </div>
  );
}
