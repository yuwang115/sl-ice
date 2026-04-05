interface HeroSectionProps {
  lang: 'en' | 'zh';
  theme: 'light' | 'dark';
}

export function HeroSection({ lang, theme }: HeroSectionProps) {
  const scrollToDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
      {/* Logo */}
      <div className="hero-stagger-1 mb-6">
        <img
          src={theme === 'dark' ? '/SL-ICE logo light.png' : '/SL-ICE logo dark.png'}
          alt="SL-ICE"
          className="h-20 sm:h-28 md:h-36 mx-auto"
        />
      </div>

      {/* Headline */}
      <h1 className="hero-stagger-2 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-glow leading-tight max-w-4xl"
        style={{ color: 'var(--text-primary)' }}
      >
        {lang === 'en'
          ? 'Slice Off a Piece of Antarctica'
          : '\u5207\u4E0B\u5357\u6781\u6D32\u7684\u4E00\u89D2'}
      </h1>

      {/* Subtitle */}
      <p className="hero-stagger-3 mt-4 md:mt-6 text-base sm:text-lg md:text-xl max-w-2xl"
        style={{ color: 'var(--text-secondary)' }}
      >
        {lang === 'en'
          ? 'A real-time ice sheet physics simulator powered by real glaciology'
          : '\u57FA\u4E8E\u771F\u5B9E\u51B0\u5DDD\u5B66\u7684\u5B9E\u65F6\u51B0\u76D6\u7269\u7406\u6A21\u62DF\u5668'}
      </p>

      {/* CTA Buttons */}
      <div className="hero-stagger-4 flex flex-col sm:flex-row gap-3 mt-8 md:mt-10">
        <a
          href="/index.html"
          className="pill-btn active"
          style={{
            padding: '12px 32px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          {lang === 'en' ? 'Launch Simulator' : '\u542F\u52A8\u6A21\u62DF\u5668'}
        </a>
        <button
          onClick={scrollToDemo}
          className="pill-btn"
          style={{
            padding: '12px 32px',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: "'Nunito', sans-serif",
          }}
        >
          {lang === 'en' ? 'Learn More' : '\u4E86\u89E3\u66F4\u591A'}
        </button>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 animate-bounce-down opacity-50">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-muted)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}
