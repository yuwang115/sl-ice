interface EducationSectionProps {
  lang: 'en' | 'zh';
}

const educationFeatures = [
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <path d="M12 6a6 6 0 0 1 6 6c0 3-2 5.5-6 8-4-2.5-6-5-6-8a6 6 0 0 1 6-6z" />
      </svg>
    ),
    title_en: 'Progressive Hints',
    title_zh: '\u6E10\u8FDB\u5F0F\u63D0\u793A',
    desc_en: 'Stuck on a challenge? Context-aware hints teach the underlying physics without giving away the answer.',
    desc_zh: '\u5361\u5728\u6311\u6218\u4E2D\uFF1F\u4E0A\u4E0B\u6587\u611F\u77E5\u7684\u63D0\u793A\u6559\u6388\u5E95\u5C42\u7269\u7406\uFF0C\u4E0D\u4F1A\u76F4\u63A5\u7ED9\u51FA\u7B54\u6848\u3002',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    title_en: 'In-Game Quizzes',
    title_zh: '\u6E38\u620F\u5185\u6D4B\u9A8C',
    desc_en: 'After each challenge, concept quizzes test your understanding of MISI, buttressing, hysteresis, and more.',
    desc_zh: '\u6BCF\u4E2A\u6311\u6218\u540E\u7684\u6982\u5FF5\u6D4B\u9A8C\uFF0C\u68C0\u9A8C\u4F60\u5BF9MISI\u3001\u652F\u6491\u6548\u5E94\u3001\u8FDF\u6EDE\u7B49\u6982\u5FF5\u7684\u7406\u89E3\u3002',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
    title_en: '16 Achievements',
    title_zh: '16\u4E2A\u6210\u5C31',
    desc_en: 'Unlock achievements as you master ice sheet concepts. Hidden achievements reward creative experimentation.',
    desc_zh: '\u638C\u63E1\u51B0\u76D6\u6982\u5FF5\u89E3\u9501\u6210\u5C31\u3002\u9690\u85CF\u6210\u5C31\u5956\u52B1\u521B\u9020\u6027\u5B9E\u9A8C\u3002',
  },
  {
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8l6 6" />
        <path d="M4 14l6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="M22 22l-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
    ),
    title_en: 'Bilingual (EN/ZH)',
    title_zh: '\u53CC\u8BED (\u82F1/\u4E2D)',
    desc_en: 'Full English and Chinese support. Switch languages instantly \u2014 every challenge, hint, quiz, and tooltip is translated.',
    desc_zh: '\u5B8C\u6574\u7684\u82F1\u4E2D\u53CC\u8BED\u652F\u6301\u3002\u4E00\u952E\u5207\u6362\u8BED\u8A00\u2014\u2014\u6BCF\u4E2A\u6311\u6218\u3001\u63D0\u793A\u3001\u6D4B\u9A8C\u548C\u63D0\u793A\u4FE1\u606F\u5747\u5DF2\u7FFB\u8BD1\u3002',
  },
] as const;

export function EducationSection({ lang }: EducationSectionProps) {
  return (
    <section className="landing-section">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 scroll-reveal">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {lang === 'en' ? 'Learn While You Play' : '\u8FB9\u73A9\u8FB9\u5B66'}
          </h2>
          <div className="section-divider" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {educationFeatures.map((f, i) => (
            <div
              key={f.title_en}
              className="glass-card p-6 flex gap-4 scroll-reveal"
              style={{ '--reveal-delay': `${(i % 2) * 100}ms` } as React.CSSProperties}
            >
              <div
                className="flex-shrink-0 mt-1"
                style={{ color: 'var(--accent)' }}
              >
                {f.icon}
              </div>
              <div>
                <h3
                  className="font-bold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {lang === 'en' ? f.title_en : f.title_zh}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {lang === 'en' ? f.desc_en : f.desc_zh}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
