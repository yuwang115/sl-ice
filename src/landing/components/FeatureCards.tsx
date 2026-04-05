interface FeatureCardsProps {
  lang: 'en' | 'zh';
}

const features = [
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6l3 7-6 11-6-11z" />
        <path d="M9 3l3 7M15 3l-3 7" />
      </svg>
    ),
    title_en: 'Sandbox Mode',
    title_zh: '\u6C99\u76D2\u6A21\u5F0F',
    desc_en: 'Full control over climate parameters. Watch ice sheets grow, retreat, and collapse in real time.',
    desc_zh: '\u5B8C\u5168\u63A7\u5236\u6C14\u5019\u53C2\u6570\u3002\u5B9E\u65F6\u89C2\u5BDF\u51B0\u76D6\u7684\u751F\u957F\u3001\u9000\u7F29\u548C\u5D29\u584C\u3002',
    accent: 'teal',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 14v4" />
      </svg>
    ),
    title_en: 'Challenge Mode',
    title_zh: '\u6311\u6218\u6A21\u5F0F',
    desc_en: '8 carefully designed levels that teach real glaciology concepts through gameplay.',
    desc_zh: '8\u4E2A\u7CBE\u5FC3\u8BBE\u8BA1\u7684\u5173\u5361\uFF0C\u901A\u8FC7\u6E38\u620F\u6559\u6388\u771F\u5B9E\u7684\u51B0\u5DDD\u5B66\u6982\u5FF5\u3002',
    accent: 'amber',
  },
  {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title_en: 'Real World Mode',
    title_zh: '\u771F\u5B9E\u4E16\u754C\u6A21\u5F0F',
    desc_en: '100 real Antarctic flowlines derived from satellite velocity fields and BedMachine data.',
    desc_zh: '100\u6761\u771F\u5B9E\u5357\u6781\u6D41\u7EBF\uFF0C\u6765\u6E90\u4E8E\u536B\u661F\u901F\u5EA6\u573A\u548CBedMachine\u6570\u636E\u3002',
    accent: 'blue',
  },
] as const;

export function FeatureCards({ lang }: FeatureCardsProps) {
  return (
    <section className="landing-section">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 scroll-reveal">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {lang === 'en' ? 'Three Ways to Explore' : '\u4E09\u79CD\u63A2\u7D22\u65B9\u5F0F'}
          </h2>
          <div className="section-divider" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title_en}
              className="glass-card p-6 md:p-8 flex flex-col scroll-reveal"
              style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
            >
              <div
                className="mb-4"
                style={{ color: `var(--accent-${f.accent === 'blue' ? '' : f.accent})`.replace('--accent-)', '--accent)') }}
              >
                <div style={{ color: f.accent === 'teal' ? 'var(--accent-teal)' : f.accent === 'amber' ? 'var(--accent-warm)' : 'var(--accent)' }}>
                  {f.icon}
                </div>
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {lang === 'en' ? f.title_en : f.title_zh}
              </h3>
              <p
                className="text-sm leading-relaxed flex-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {lang === 'en' ? f.desc_en : f.desc_zh}
              </p>
              <div
                className="mt-5 h-0.5 rounded-full"
                style={{
                  background: `var(--card-border-${f.accent})`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
