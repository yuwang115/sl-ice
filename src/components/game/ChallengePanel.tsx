/**
 * Challenge selection, active challenge overlay, and result screen.
 * Shows star ratings, scores, and educational debrief on completion.
 */

import { useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import { challenges } from '../../challenges';
import { getNarrative } from '../../challenges/narrative';
import ChallengeBriefing from './ChallengeBriefing';
import type { ChallengeResult } from '../../store/game-store';

/* ─── SVG Star (reusable for difficulty + rating) ────────── */
function Star({ filled, delay = 0, size = 14, color }: { filled: boolean; delay?: number; size?: number; color?: string }) {
  const fillColor = color || 'var(--accent-warm)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="transition-transform group-hover:scale-110"
      style={{ transitionDelay: `${delay}ms` }}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={filled ? fillColor : 'none'}
        stroke={filled ? fillColor : 'var(--text-muted)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── SVG Lock Icon ─────────────────────────────────────── */
function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ─── SVG Checkmark ─────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ─── SVG Back Arrow ────────────────────────────────────── */
function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mr-1">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

/* ─── Challenge Result Overlay ──────────────────────────── */

/** Concept explanations shown after challenge completion (en/zh) */
const conceptDebriefs: Record<string, { en: string; zh: string }> = {
  mass_balance: {
    en: 'An ice sheet stays stable when snowfall inland equals ice loss at the edges. This dynamic equilibrium is surprisingly delicate.',
    zh: '当内陆降雪量等于边缘冰损失时，冰盖保持稳定。这种动态平衡出乎意料地脆弱。',
  },
  misi: {
    en: 'Marine Ice Sheet Instability (MISI) is a self-reinforcing retreat on reverse-sloping bedrock. Once triggered, even cooling the climate may not stop it.',
    zh: '海洋冰盖不稳定性（MISI）是逆坡基岩上的自强化退缩。一旦触发，即使降温也可能无法阻止。',
  },
  buttressing: {
    en: 'Ice shelves act like corks, bracing the ice sheet behind them. When they collapse, ice accelerates into the ocean.',
    zh: '冰架如同瓶塞，支撑着身后的冰盖。当冰架崩塌，冰盖会加速涌入海洋。',
  },
  hydrology: {
    en: 'Water beneath the ice reduces friction, accelerating flow. This positive feedback loop can destabilize entire glaciers.',
    zh: '冰下水减少摩擦，加速冰流。这种正反馈循环可以使整个冰川失稳。',
  },
  hysteresis: {
    en: 'Some climate tipping points are irreversible — even after returning to original conditions, the ice sheet cannot recover. Prevention is far easier than cure.',
    zh: '某些气候临界点是不可逆的——即使恢复到原始条件，冰盖也无法恢复。预防远比治疗容易。',
  },
  geoengineering: {
    en: 'Seafloor barriers could slow warm water reaching glaciers, but they are temporary fixes. The root cause — warming oceans — must still be addressed.',
    zh: '海底屏障可以减缓暖水到达冰川，但这只是临时措施。根本原因——海洋变暖——仍然需要解决。',
  },
  sensitivity: {
    en: 'Tiny differences in initial conditions can lead to vastly different outcomes over centuries. This is why scientists use ensemble modeling with many simulations.',
    zh: '初始条件的微小差异可以在数百年后导致截然不同的结果。这就是科学家使用集合模拟的原因。',
  },
  mici: {
    en: 'Marine Ice Cliff Instability (MICI) occurs when exposed ice cliffs are too tall to support their own weight, triggering cascading collapse.',
    zh: '海洋冰崖不稳定性（MICI）发生在暴露的冰崖因过高而无法支撑自身重量时，引发连锁崩塌。',
  },
};

function ChallengeResultOverlay({ result }: { result: ChallengeResult }) {
  const { dismissChallengeResult, setMode } = useGameStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const challenge = challenges.find((c) => c.id === result.challengeId);
  if (!challenge) return null;

  const handleRetry = () => {
    dismissChallengeResult();
  };

  const handleContinue = () => {
    dismissChallengeResult();
  };

  const handleNextChallenge = () => {
    dismissChallengeResult();
  };

  // Pick the first concept for debrief
  const mainConcept = challenge.concepts[0];
  const debrief = conceptDebriefs[mainConcept];

  // Narrative debrief (longer, connects to real world)
  const narrative = getNarrative(result.challengeId);
  const narrativeDebrief = narrative ? (isZh ? narrative.debrief_zh : narrative.debrief_en) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="glass-panel rounded-2xl p-8 max-w-md w-full mx-4 animate-in"
        style={{ animation: 'ghibli-fade-in 0.4s ease-out' }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="text-4xl mb-2"
            style={{
              filter: result.won ? 'none' : 'grayscale(1)',
            }}
          >
            {result.won ? '🏔️' : '🌊'}
          </div>
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: result.won ? 'var(--accent-teal)' : 'var(--accent-danger)' }}
          >
            {result.won
              ? (isZh ? '挑战成功！' : 'Challenge Complete!')
              : (isZh ? '挑战失败' : 'Challenge Failed')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {isZh ? challenge.name_zh : challenge.name_en}
          </p>
        </div>

        {/* Score + Stars (only if won) */}
        {result.won && (
          <div className="text-center mb-6">
            {/* Star rating */}
            <div className="flex items-center justify-center gap-1 mb-3">
              {[1, 2, 3].map((i) => (
                <Star
                  key={i}
                  filled={i <= result.stars}
                  size={28}
                  delay={i * 150}
                  color="var(--accent-warm)"
                />
              ))}
            </div>
            {/* Score */}
            <div className="font-data text-3xl font-bold" style={{ color: 'var(--accent)' }}>
              {result.score}
            </div>
            <div className="font-data text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {isZh ? '分数' : 'Score'}
            </div>
            {/* Time */}
            <div className="mt-2 font-data text-xs" style={{ color: 'var(--text-muted)' }}>
              {isZh ? `${result.elapsedYears} 模拟年` : `${result.elapsedYears} simulated years`}
            </div>
          </div>
        )}

        {/* Educational debrief */}
        {debrief && (
          <div
            className="rounded-lg p-3 mb-6 text-xs leading-relaxed"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {isZh ? '你学到了什么' : 'What You Learned'}
            </div>
            {isZh ? debrief.zh : debrief.en}
          </div>
        )}

        {/* Real-world narrative debrief */}
        {result.won && narrativeDebrief && (
          <div
            className="rounded-lg p-3 mb-6 text-xs leading-relaxed"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              borderLeft: '3px solid var(--accent-teal)',
            }}
          >
            <div className="font-semibold mb-1" style={{ color: 'var(--accent-teal)' }}>
              {isZh ? '真实世界' : 'In the Real World'}
            </div>
            {narrativeDebrief}
          </div>
        )}

        {/* Failure explanation */}
        {!result.won && (
          <div
            className="rounded-lg p-3 mb-6 text-xs leading-relaxed"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              borderLeft: '3px solid var(--accent-danger)',
            }}
          >
            <div className="font-semibold mb-1" style={{ color: 'var(--accent-danger)' }}>
              {isZh ? '失败并非终点' : 'Failure Is Part of Learning'}
            </div>
            {isZh
              ? '每次失败都加深了你对冰川动力学的理解。试着重新审视参数的影响，然后再来一次。'
              : 'Each failure deepens your understanding of ice dynamics. Review how your parameter choices affected the outcome, then try again.'}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {!result.won && (
            <button
              onClick={handleRetry}
              className="pill-btn flex-1 text-sm"
              style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
            >
              {isZh ? '再试一次' : 'Try Again'}
            </button>
          )}
          <button
            onClick={result.won ? handleNextChallenge : handleContinue}
            className="pill-btn flex-1 text-sm"
            style={result.won ? { background: 'var(--accent-teal)', color: 'white', borderColor: 'var(--accent-teal)' } : undefined}
          >
            {result.won
              ? (isZh ? '下一关' : 'Next Challenge')
              : (isZh ? '返回列表' : 'Back to List')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Challenge Progress Bar (during active challenge) ──── */
function ChallengeProgressBar({ challengeId }: { challengeId: number }) {
  const physicsState = usePhysicsStore((s) => s.state);
  const challengeStartYear = useGameStore((s) => s.challengeStartYear);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const challenge = challenges.find((c) => c.id === challengeId);
  if (!challenge || !physicsState || challengeStartYear === null) return null;

  const elapsed = physicsState.year - challengeStartYear;
  const progress = Math.min(1, elapsed / challenge.duration_years);
  const remaining = Math.max(0, challenge.duration_years - elapsed);

  // Color: green when doing well, red when in danger
  const volumeChange = useGameStore.getState().challengeInitialVolume
    ? Math.abs(physicsState.volume - useGameStore.getState().challengeInitialVolume!) / useGameStore.getState().challengeInitialVolume!
    : 0;
  const isDanger = volumeChange > 0.2 || physicsState.sea_level > 1.0 || physicsState.is_misi_active;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 glass-panel rounded-full px-4 py-1.5 flex items-center gap-3 text-xs">
      <span className="font-data" style={{ color: 'var(--text-muted)' }}>
        {isZh ? `${Math.round(elapsed)}年` : `Year ${Math.round(elapsed)}`}
      </span>
      <div
        className="w-32 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--slider-track-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress * 100}%`,
            background: isDanger
              ? 'var(--accent-danger)'
              : progress > 0.8
                ? 'var(--accent-teal)'
                : 'var(--accent)',
            animation: isDanger ? 'glow-pulse 1.5s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <span className="font-data" style={{ color: 'var(--text-muted)' }}>
        {isZh ? `剩余 ${Math.round(remaining)}年` : `${Math.round(remaining)}yr left`}
      </span>
    </div>
  );
}

/* ─── Sea Level Impact Ticker ───────────────────────────── */
function SeaLevelImpact() {
  const physicsState = usePhysicsStore((s) => s.state);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  if (!physicsState || physicsState.sea_level < 0.1) return null;

  const sl = physicsState.sea_level;

  // Find the highest impact tier that has been reached
  const impacts = [
    { threshold: 0.3, en: 'Low-lying islands at risk', zh: '低洼岛屿面临风险' },
    { threshold: 0.5, en: 'Shanghai, Miami, Venice flooding', zh: '上海、迈阿密、威尼斯开始受灾' },
    { threshold: 1.0, en: '17M displaced in Bangladesh', zh: '孟加拉国1700万人流离失所' },
    { threshold: 2.0, en: 'Major port cities submerged', zh: '主要港口城市被淹没' },
    { threshold: 3.0, en: 'Global coastline reshaped', zh: '全球海岸线重塑' },
  ];

  const activeImpact = [...impacts].reverse().find((i) => sl >= i.threshold);
  if (!activeImpact) return null;

  const severity = sl >= 2.0 ? 'critical' : sl >= 1.0 ? 'warning' : 'info';
  const color = severity === 'critical' ? 'var(--accent-danger)' : severity === 'warning' ? 'var(--accent-warm)' : 'var(--accent)';

  return (
    <div
      className="absolute bottom-4 left-4 z-10 glass-panel rounded-lg px-3 py-2 flex items-center gap-2 text-xs animate-in"
      style={{ borderLeft: `3px solid ${color}`, maxWidth: '280px' }}
    >
      <span style={{ fontSize: '16px' }}>🌊</span>
      <div>
        <div className="font-data font-bold" style={{ color }}>
          +{sl.toFixed(2)}m
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>
          {isZh ? activeImpact.zh : activeImpact.en}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export default function ChallengePanel() {
  const { currentChallenge, challengeProgress, challengeResult, startChallenge, dismissChallengeResult, setMode, setParams, setRunning, setSpeed } = useGameStore();
  const { loadScenario } = usePhysicsStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  // Briefing state: which challenge is showing its briefing
  const [briefingId, setBriefingId] = useState<number | null>(null);

  const launchChallenge = async (id: number) => {
    const challenge = challenges.find((c) => c.id === id);
    if (!challenge) return;

    try {
      const resp = await fetch(`/data/scenarios/${challenge.scenario}.json`);
      const config = await resp.json();
      loadScenario(config);

      setParams({
        T_atm_delta: 0,
        T_ocean_delta: 0,
        precip_scale: 1.0,
        drain_efficiency: 1.0,
        enable_hydrology: challenge.enable_hydrology,
        ...challenge.initial_params,
      });

      startChallenge(id);
      setRunning(true);
    } catch (err) {
      console.error('Failed to load challenge scenario:', err);
    }
  };

  const handleStart = (id: number) => {
    setBriefingId(id);
  };

  // Show result overlay if challenge just ended
  if (challengeResult) {
    return <ChallengeResultOverlay result={challengeResult} />;
  }

  // Show briefing before challenge starts
  if (briefingId !== null) {
    return (
      <ChallengeBriefing
        challengeId={briefingId}
        onStart={async () => {
          const id = briefingId;
          await launchChallenge(id);
          setBriefingId(null);
        }}
        onCancel={() => setBriefingId(null)}
      />
    );
  }

  const handleAbandon = () => {
    if (!currentChallenge) return;
    useGameStore.getState().completeChallenge(currentChallenge, false);
    useGameStore.setState({ currentChallenge: null });
    setRunning(false);
    setSpeed('paused');
  };

  // Active challenge overlay (during gameplay)
  if (currentChallenge) {
    const challenge = challenges.find((c) => c.id === currentChallenge);
    if (!challenge) return null;

    return (
      <>
        {/* Progress bar at top */}
        <ChallengeProgressBar challengeId={currentChallenge} />

        {/* Challenge info panel */}
        <div className="absolute top-16 left-4 z-10 glass-panel rounded-xl p-4 max-w-sm animate-in">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-2 h-2 rounded-full animate-glow"
              style={{ background: 'var(--accent-warm)' }}
            />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isZh ? challenge.name_zh : challenge.name_en}
            </h3>
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            {isZh ? challenge.subtitle_zh : challenge.subtitle_en}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {isZh ? challenge.description_zh : challenge.description_en}
          </p>
          <div className="mt-2 flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} filled={i < challenge.difficulty} delay={i * 50} />
            ))}
          </div>
          <button
            onClick={handleAbandon}
            className="pill-btn text-[11px] mt-3 hover:!border-[var(--accent-danger)] hover:!text-[var(--accent-danger)]"
          >
            {isZh ? '放弃挑战' : 'Abandon Challenge'}
          </button>
        </div>

        {/* Sea level impact ticker */}
        <SeaLevelImpact />
      </>
    );
  }

  // Challenge progress stats
  const wonCount = challengeProgress.filter((p) => p.status === 'won').length;
  const totalCount = challenges.length;
  const progressPct = (wonCount / totalCount) * 100;

  // Total stars
  const totalStars = challengeProgress.reduce((sum, p) => sum + (p.bestStars || 0), 0);
  const maxStars = totalCount * 3;

  // Challenge selection list
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        {isZh ? '挑战关卡' : 'Challenges'}
      </h2>

      {/* Progress bar + star count */}
      <div className="w-full max-w-3xl mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-data text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {isZh ? '进度' : 'Progress'}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-data text-[11px] flex items-center gap-1" style={{ color: 'var(--accent-warm)' }}>
              <Star filled size={10} color="var(--accent-warm)" /> {totalStars}/{maxStars}
            </span>
            <span className="font-data text-[11px] font-medium" style={{ color: 'var(--accent-teal)' }}>
              {wonCount}/{totalCount}
            </span>
          </div>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--slider-track-bg)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: 'var(--accent-teal)',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl w-full">
        {challenges.map((challenge) => {
          const progress = challengeProgress.find((p) => p.id === challenge.id);
          const isLocked = progress?.status === 'locked';
          const isWon = progress?.status === 'won';

          return (
            <button
              key={challenge.id}
              onClick={() => !isLocked && handleStart(challenge.id)}
              disabled={isLocked}
              className="glass-card group text-left p-4 relative overflow-hidden"
              style={{
                cursor: isLocked ? 'not-allowed' : 'pointer',
                borderColor: isWon ? 'var(--won-border)' : undefined,
                background: isWon ? 'var(--won-bg)' : undefined,
              }}
            >
              {/* Locked overlay */}
              {isLocked && (
                <div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-lg)]"
                  style={{
                    background: 'var(--bg-deep)',
                    opacity: 0.6,
                    backdropFilter: 'blur(2px)',
                  }}
                >
                  <LockIcon />
                </div>
              )}

              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {challenge.id}. {isZh ? challenge.name_zh : challenge.name_en}
                </span>
                <div className="flex items-center gap-2">
                  {/* Best score badge */}
                  {progress?.bestScore != null && progress.bestScore > 0 && (
                    <span className="font-data text-[10px] font-bold" style={{ color: 'var(--accent)' }}>
                      {progress.bestScore}
                    </span>
                  )}
                  {isWon && <CheckIcon />}
                </div>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                {isZh ? challenge.subtitle_zh : challenge.subtitle_en}
              </p>
              <div className="flex items-center justify-between">
                {/* Difficulty stars */}
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} filled={i < challenge.difficulty} delay={i * 60} />
                  ))}
                </div>
                {/* Rating stars (if won) */}
                {isWon && progress?.bestStars != null && progress.bestStars > 0 && (
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((i) => (
                      <Star key={i} filled={i <= (progress.bestStars || 0)} size={12} color="var(--accent-teal)" />
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setMode('menu')}
        className="mt-8 text-sm transition-colors hover:text-[var(--text-secondary)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft />
        {isZh ? '返回菜单' : 'Back to menu'}
      </button>
    </div>
  );
}
