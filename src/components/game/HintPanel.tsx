/**
 * Progressive hint panel for active challenges.
 * Shows up to 3 levels of hints with progressive unlock and score penalties.
 */

import { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import { getHintsForChallenge } from '../../challenges/hints';

export default function HintPanel() {
  const currentChallenge = useGameStore((s) => s.currentChallenge);
  const challengeStartYear = useGameStore((s) => s.challengeStartYear);
  const challengeProgress = useGameStore((s) => s.challengeProgress);
  const physicsState = usePhysicsStore((s) => s.state);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const [revealedLevels, setRevealedLevels] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentChallenge) return null;

  const hints = getHintsForChallenge(currentChallenge);
  if (hints.length === 0) return null;

  const elapsed = physicsState && challengeStartYear != null
    ? physicsState.year - challengeStartYear
    : 0;

  // Check if player has failed this challenge before
  const progress = challengeProgress.find((p) => p.id === currentChallenge);
  const hasFailed = (progress?.attempts || 0) > 1;

  const handleReveal = (level: number) => {
    setRevealedLevels((prev) => new Set([...prev, level]));
  };

  // Determine which levels are unlockable
  const isUnlocked = (level: number): boolean => {
    if (level === 1) return true; // Always available
    if (level === 2) return elapsed >= 100; // After 100 simulated years
    if (level === 3) return hasFailed; // After failing once
    return false;
  };

  const getUnlockLabel = (level: number): string => {
    if (level === 2) {
      const remaining = Math.max(0, 100 - elapsed);
      if (remaining > 0) {
        return isZh ? `${Math.round(remaining)}年后解锁` : `Unlocks in ${Math.round(remaining)} years`;
      }
    }
    if (level === 3 && !hasFailed) {
      return isZh ? '失败一次后解锁' : 'Unlocks after first failure';
    }
    return '';
  };

  return (
    <div className="absolute bottom-4 right-4 z-10" style={{ maxWidth: '260px' }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="pill-btn text-[11px] flex items-center gap-1.5 ml-auto"
        style={{
          background: isExpanded ? 'var(--accent)' : undefined,
          color: isExpanded ? 'white' : undefined,
          borderColor: isExpanded ? 'var(--accent)' : undefined,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {isZh ? '提示' : 'Hints'}
      </button>

      {/* Hint panel */}
      {isExpanded && (
        <div
          className="glass-panel rounded-xl p-3 mt-2 animate-in"
          style={{ animation: 'ghibli-fade-in 0.3s ease-out' }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {isZh ? '渐进提示' : 'Progressive Hints'}
          </div>

          <div className="space-y-2">
            {hints.map((hint) => {
              const unlocked = isUnlocked(hint.level);
              const revealed = revealedLevels.has(hint.level);
              const unlockLabel = getUnlockLabel(hint.level);

              return (
                <div key={hint.level} className="relative">
                  {/* Level header */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-data uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {isZh ? `第${hint.level}级` : `Level ${hint.level}`}
                    </span>
                    {hint.penalty > 0 && (
                      <span className="text-[10px] font-data" style={{ color: 'var(--accent-warm)' }}>
                        -{hint.penalty} {isZh ? '分' : 'pts'}
                      </span>
                    )}
                    {hint.penalty === 0 && (
                      <span className="text-[10px] font-data" style={{ color: 'var(--accent-teal)' }}>
                        {isZh ? '免费' : 'Free'}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {revealed ? (
                    <p
                      className="text-xs leading-relaxed rounded-md p-2"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      {isZh ? hint.zh : hint.en}
                    </p>
                  ) : unlocked ? (
                    <button
                      onClick={() => handleReveal(hint.level)}
                      className="w-full text-left text-xs rounded-md p-2 transition-colors"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                      }}
                    >
                      {isZh ? '点击查看提示' : 'Click to reveal'}
                      {hint.penalty > 0 && (
                        <span style={{ color: 'var(--accent-warm)' }}>
                          {' '}({isZh ? `扣${hint.penalty}分` : `-${hint.penalty} pts`})
                        </span>
                      )}
                    </button>
                  ) : (
                    <div
                      className="text-[10px] rounded-md p-2"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                    >
                      🔒 {unlockLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
