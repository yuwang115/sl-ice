import { challenges, conceptLabels } from '../data/challenges';

interface ChallengeShowcaseProps {
  lang: 'en' | 'zh';
}

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={i < count ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          className={i < count ? 'star-filled' : 'star-empty'}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export function ChallengeShowcase({ lang }: ChallengeShowcaseProps) {
  return (
    <section className="landing-section">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12 scroll-reveal">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {lang === 'en' ? '8 Challenges, One Ice Sheet' : '8\u4E2A\u6311\u6218\uFF0C\u4E00\u7247\u51B0\u76D6'}
          </h2>
          <div className="section-divider" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((c, i) => (
            <div
              key={c.id}
              className={`glass-card p-5 flex gap-4 scroll-reveal ${c.locked ? 'opacity-50' : ''}`}
              style={{ '--reveal-delay': `${(i % 2) * 100}ms` } as React.CSSProperties}
            >
              {/* Number badge */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                style={{
                  background: c.locked ? 'var(--text-muted)' : 'var(--accent)',
                  color: '#fff',
                  opacity: c.locked ? 0.5 : 1,
                }}
              >
                {c.locked ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  c.id
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3
                    className="font-bold text-sm truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {lang === 'en' ? c.name_en : c.name_zh}
                  </h3>
                  <Stars count={c.difficulty} />
                </div>

                <p
                  className="text-xs mb-2 line-clamp-2"
                  style={{ color: c.locked ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                >
                  {c.locked
                    ? (lang === 'en' ? c.lockReason_en : c.lockReason_zh)
                    : (lang === 'en' ? c.subtitle_en : c.subtitle_zh)}
                </p>

                {/* Concept pills */}
                {!c.locked && (
                  <div className="flex flex-wrap gap-1">
                    {c.concepts.map((concept) => {
                      const label = conceptLabels[concept];
                      return (
                        <span
                          key={concept}
                          className="px-2 py-0.5 rounded-full text-xs font-data"
                          style={{
                            background: 'var(--badge-bg)',
                            border: '1px solid var(--badge-border)',
                            color: 'var(--badge-text)',
                            fontSize: '10px',
                          }}
                        >
                          {label ? (lang === 'en' ? label.en : label.zh) : concept}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
