import { BASE } from '../../base';

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

          {/* Promo video with overlay link to simulator */}
          <a
            href={`${BASE}/index.html`}
            className="block relative group cursor-pointer bg-black"
            style={{ aspectRatio: '16/9' }}
            aria-label={lang === 'en' ? 'Launch SL-ICE simulator' : '\u542F\u52A8 SL-ICE \u6A21\u62DF\u5668'}
          >
            <video
              src={`${BASE}/promo.mp4`}
              poster={`${BASE}/promo-poster.jpg`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover block"
            />

            {/* Play overlay — appears on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 30px rgba(74, 144, 168, 0.55)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                  <polygon points="8,5 20,12 8,19" />
                </svg>
              </div>
            </div>

            {/* Click-to-launch badge */}
            <div className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-data pointer-events-none"
              style={{
                background: 'rgba(0,0,0,0.55)',
                color: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(4px)',
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
