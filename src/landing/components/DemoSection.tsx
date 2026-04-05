interface DemoSectionProps {
  lang: 'en' | 'zh';
}

export function DemoSection({ lang }: DemoSectionProps) {
  return (
    <section id="demo" className="landing-section">
      <div className="max-w-5xl mx-auto">
        {/* Browser chrome mockup */}
        <div className="browser-chrome scroll-reveal">
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

          {/* Screenshot / Video placeholder */}
          <a
            href="/index.html"
            className="block relative group cursor-pointer"
            style={{ aspectRatio: '16/9' }}
          >
            {/* Gradient placeholder with visual pattern */}
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-4"
              style={{
                background: 'linear-gradient(135deg, #0a1a3a 0%, #0d2847 30%, #0f3355 60%, #1a4a6e 100%)',
              }}
            >
              {/* Ice cross-section sketch */}
              <svg viewBox="0 0 800 300" className="w-3/4 max-w-lg opacity-70">
                {/* Bedrock */}
                <path d="M0 280 Q100 260 200 250 Q300 220 400 230 Q500 210 600 240 Q700 255 800 270 L800 300 L0 300 Z" fill="#3a2820" />
                {/* Ice */}
                <path d="M0 120 Q100 100 200 110 Q300 80 400 90 Q500 70 550 100 L550 250 Q500 210 400 230 Q300 220 200 250 Q100 260 0 280 Z" fill="#6bb8d6" opacity="0.8" />
                {/* Ocean */}
                <path d="M550 100 Q600 80 700 90 Q750 95 800 100 L800 270 Q700 255 600 240 Q550 230 550 250 Z" fill="#1a5a80" opacity="0.6" />
                {/* Grounding line */}
                <line x1="550" y1="100" x2="550" y2="250" stroke="#e06868" strokeWidth="2" strokeDasharray="6 3" />
                {/* Snow particles */}
                {[80, 150, 250, 350, 420, 180, 300].map((x, i) => (
                  <circle key={i} cx={x} cy={40 + i * 8} r="2" fill="white" opacity="0.5" />
                ))}
              </svg>

              <span className="text-white/60 text-sm font-data">
                {lang === 'en' ? '[ Demo screenshot / video placeholder ]' : '[ \u6F14\u793A\u622A\u56FE / \u89C6\u9891\u5360\u4F4D\u7B26 ]'}
              </span>
            </div>

            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 30px rgba(74, 144, 168, 0.4)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <polygon points="8,5 20,12 8,19" />
                </svg>
              </div>
            </div>

            {/* Badge */}
            <div className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-data"
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {lang === 'en' ? 'Click to launch' : '\u70B9\u51FB\u542F\u52A8'}
            </div>
          </a>
        </div>

        {/* Caption */}
        <p
          className="mt-4 text-center text-xs md:text-sm font-data scroll-reveal"
          style={{ color: 'var(--text-muted)', '--reveal-delay': '100ms' } as React.CSSProperties}
        >
          {lang === 'en'
            ? 'Real-time Blatter\u2013Pattyn ice sheet simulation running in your browser'
            : '\u57FA\u4E8EBlatter\u2013Pattyn\u6A21\u578B\u7684\u5B9E\u65F6\u51B0\u76D6\u6A21\u62DF\uFF0C\u5728\u6D4F\u89C8\u5668\u4E2D\u8FD0\u884C'}
        </p>
      </div>
    </section>
  );
}
