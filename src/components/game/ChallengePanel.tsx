/**
 * Challenge selection and info panel.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import { challenges } from '../../challenges';

export default function ChallengePanel() {
  const { currentChallenge, challengeProgress, startChallenge, setMode, setParams, setRunning } = useGameStore();
  const { loadScenario } = usePhysicsStore();
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const handleStart = async (id: number) => {
    const challenge = challenges.find((c) => c.id === id);
    if (!challenge) return;

    try {
      const resp = await fetch(`/data/scenarios/${challenge.scenario}.json`);
      const config = await resp.json();
      loadScenario(config);

      if (challenge.initial_params) {
        setParams({
          T_atm_delta: 0,
          T_ocean_delta: 0,
          precip_scale: 1.0,
          drain_efficiency: 1.0,
          enable_hydrology: challenge.enable_hydrology,
          ...challenge.initial_params,
        });
      }

      startChallenge(id);
      setRunning(true);
    } catch (err) {
      console.error('Failed to load challenge scenario:', err);
    }
  };

  // Active challenge overlay
  if (currentChallenge) {
    const challenge = challenges.find((c) => c.id === currentChallenge);
    if (!challenge) return null;

    return (
      <div className="absolute top-16 left-4 z-10 glass-panel rounded-xl p-4 max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm" style={{ color: 'var(--accent-warm)' }}>{'\u25c9'}</span>
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
            <span key={i} style={{ color: i < challenge.difficulty ? 'var(--accent-warm)' : 'var(--text-muted)', fontSize: '12px' }}>
              {'\u2605'}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Challenge selection list
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {isZh ? '\u6311\u6218\u5173\u5361' : 'Challenges'}
      </h2>

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
              className="glass-card text-left p-4"
              style={{
                opacity: isLocked ? 0.4 : 1,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                borderColor: isWon ? 'var(--won-border)' : undefined,
                background: isWon ? 'var(--won-bg)' : undefined,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {challenge.id}. {isZh ? challenge.name_zh : challenge.name_en}
                </span>
                {isWon && <span style={{ color: 'var(--accent-teal)' }}>{'\u2713'}</span>}
                {isLocked && <span style={{ color: 'var(--text-muted)' }}>{'\ud83d\udd12'}</span>}
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                {isZh ? challenge.subtitle_zh : challenge.subtitle_en}
              </p>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ color: i < challenge.difficulty ? 'var(--accent-warm)' : 'var(--text-muted)', fontSize: '11px' }}>
                    {'\u2605'}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setMode('menu')}
        className="mt-8 text-sm transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        {'\u2190'} {isZh ? '\u8fd4\u56de\u83dc\u5355' : 'Back to menu'}
      </button>
    </div>
  );
}
