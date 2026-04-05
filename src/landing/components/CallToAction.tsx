interface CallToActionProps {
  lang: 'en' | 'zh';
}

export function CallToAction({ lang }: CallToActionProps) {
  return (
    <section className="landing-section relative overflow-hidden">
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: 'linear-gradient(135deg, var(--accent), var(--accent-teal))',
        }}
      />

      <div className="relative max-w-3xl mx-auto text-center scroll-reveal">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-glow"
          style={{ color: 'var(--text-primary)' }}
        >
          {lang === 'en' ? 'Ready to Explore the Ice?' : '\u51C6\u5907\u597D\u63A2\u7D22\u51B0\u76D6\u4E86\u5417\uFF1F'}
        </h2>

        <p
          className="text-sm md:text-base mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          {lang === 'en'
            ? 'Free. No account required. Works in any modern browser.'
            : '\u514D\u8D39\u3002\u65E0\u9700\u6CE8\u518C\u3002\u652F\u6301\u6240\u6709\u73B0\u4EE3\u6D4F\u89C8\u5668\u3002'}
        </p>

        <a
          href="/index.html"
          className="pill-btn active animate-breathe inline-flex"
          style={{
            padding: '14px 40px',
            fontSize: '16px',
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          {lang === 'en' ? 'Launch SL-ICE' : '\u542F\u52A8 SL-ICE'}
        </a>

        {/* Media placeholder for future screenshot gallery */}
        <div
          className="mt-12 mx-auto max-w-md rounded-xl p-8 text-center"
          style={{
            border: '2px dashed var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          <p className="text-xs font-data">
            {lang === 'en'
              ? '[ Screenshot gallery placeholder ]'
              : '[ \u622A\u56FE\u753B\u5ECA\u5360\u4F4D\u7B26 ]'}
          </p>
        </div>
      </div>
    </section>
  );
}
