import { BASE } from '../../base';

interface PromoCardProps {
  lang: 'en' | 'zh';
  theme: 'light' | 'dark';
}

export function PromoCard({ lang, theme }: PromoCardProps) {
  const scrollToChallenges = () => {
    document.getElementById('challenges')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="landing-section">
      <div className="promo-card scroll-reveal-scale max-w-6xl mx-auto">
        {/* Left: Text content */}
        <div className="promo-card__content">
          <img
            src={theme === 'dark' ? `${BASE}/SL-ICE logo light.png` : `${BASE}/SL-ICE logo dark.png`}
            alt="SL-ICE"
            className="h-10 sm:h-12 md:h-14 mb-5"
            style={{ objectFit: 'contain', objectPosition: 'left' }}
          />

          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {lang === 'en'
              ? 'Explore Real Ice Sheet Physics'
              : '探索真实的冰盖物理'}
          </h2>

          <p
            className="text-sm sm:text-base leading-relaxed mb-6"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.78 }}
          >
            {lang === 'en'
              ? 'SL-ICE brings Antarctic glaciology to life with a real-time Blatter\u2013Pattyn simulator. Adjust climate parameters, watch ice flow, and understand the science behind sea-level rise \u2014 all in your browser.'
              : 'SL-ICE \u901A\u8FC7\u5B9E\u65F6 Blatter\u2013Pattyn \u6A21\u62DF\u5668\u5C06\u5357\u6781\u51B0\u5DDD\u5B66\u5E26\u5165\u751F\u6D3B\u3002\u8C03\u8282\u6C14\u5019\u53C2\u6570\u3001\u89C2\u5BDF\u51B0\u6D41\u52A8\u6001\u3001\u7406\u89E3\u6D77\u5E73\u9762\u4E0A\u5347\u80CC\u540E\u7684\u79D1\u5B66\u2014\u2014\u5168\u90E8\u5728\u6D4F\u89C8\u5668\u4E2D\u5B8C\u6210\u3002'}
          </p>

          <div className="flex flex-wrap gap-3">
            <a href={`${BASE}/index.html`} className="promo-btn-primary">
              {lang === 'en' ? 'Launch Simulator' : '\u542F\u52A8\u6A21\u62DF\u5668'}
            </a>
            <button onClick={scrollToChallenges} className="promo-btn-ghost">
              {lang === 'en' ? 'View Challenges' : '\u67E5\u770B\u6311\u6218\u5173\u5361'}
            </button>
          </div>
        </div>

        {/* Right: Browser mockup showcase */}
        <div className="promo-card__showcase">
          <div className="browser-chrome" style={{ borderRadius: 'var(--radius-lg)' }}>
            <div className="browser-chrome-bar">
              <div className="browser-dot" style={{ background: '#ff5f57' }} />
              <div className="browser-dot" style={{ background: '#febc2e' }} />
              <div className="browser-dot" style={{ background: '#28c840' }} />
              <div
                className="ml-3 flex-1 h-6 rounded-md font-data text-xs flex items-center px-3"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                }}
              >
                sl-ice.app
              </div>
            </div>

            <a
              href={`${BASE}/index.html`}
              className="block relative group cursor-pointer"
              style={{ aspectRatio: '4/3' }}
            >
              {/* Ice cross-section illustration */}
              <div
                className="w-full h-full flex flex-col items-center justify-center gap-4"
                style={{
                  background:
                    'linear-gradient(135deg, #0a1a3a 0%, #0d2847 30%, #0f3355 60%, #1a4a6e 100%)',
                }}
              >
                <svg viewBox="0 0 800 300" className="w-4/5 max-w-md opacity-75">
                  {/* Bedrock */}
                  <path
                    d="M0 280 Q100 260 200 250 Q300 220 400 230 Q500 210 600 240 Q700 255 800 270 L800 300 L0 300 Z"
                    fill="#3a2820"
                  />
                  {/* Ice */}
                  <path
                    d="M0 120 Q100 100 200 110 Q300 80 400 90 Q500 70 550 100 L550 250 Q500 210 400 230 Q300 220 200 250 Q100 260 0 280 Z"
                    fill="#6bb8d6"
                    opacity="0.8"
                  />
                  {/* Ocean */}
                  <path
                    d="M550 100 Q600 80 700 90 Q750 95 800 100 L800 270 Q700 255 600 240 Q550 230 550 250 Z"
                    fill="#1a5a80"
                    opacity="0.6"
                  />
                  {/* Grounding line */}
                  <line
                    x1="550" y1="100" x2="550" y2="250"
                    stroke="#e06868" strokeWidth="2" strokeDasharray="6 3"
                  />
                  {/* Snow particles */}
                  {[80, 150, 250, 350, 420, 180, 300].map((x, i) => (
                    <circle key={i} cx={x} cy={40 + i * 8} r="2" fill="white" opacity="0.5" />
                  ))}
                </svg>

                <span className="text-white/50 text-xs font-data">
                  {lang === 'en' ? 'Real-time ice sheet simulation' : '\u5B9E\u65F6\u51B0\u76D6\u6A21\u62DF'}
                </span>
              </div>

              {/* Hover play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: 'var(--accent)',
                    boxShadow: '0 0 30px rgba(74, 144, 168, 0.4)',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <polygon points="8,5 20,12 8,19" />
                  </svg>
                </div>
              </div>

              {/* Badge */}
              <div
                className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-data"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {lang === 'en' ? 'Click to launch' : '\u70B9\u51FB\u542F\u52A8'}
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
