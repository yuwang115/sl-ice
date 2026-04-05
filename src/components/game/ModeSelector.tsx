/**
 * Main menu / mode selector screen.
 */

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useGameStore } from '../../store/game-store';
import { useUIStore } from '../../store/ui-store';
import ThemeToggle from '../controls/ThemeToggle';
import type { GameMode } from '../../engine/types';

/* ─── Mode Card Icons ───────────────────────────────────── */
const IconBeaker = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 3h15" />
    <path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3" />
    <path d="M6 14h12" />
  </svg>
);

const IconTrophy = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const IconGlobe = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const IconCompass = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const modeIcons: Record<string, ComponentType> = {
  sandbox: IconBeaker,
  challenge: IconTrophy,
  real_world: IconGlobe,
  explorer: IconCompass,
};

export default function ModeSelector() {
  const setMode = useGameStore((s) => s.setMode);
  const language = useUIStore((s) => s.language);
  const theme = useUIStore((s) => s.theme);
  const { toggleLanguage } = useUIStore();
  const isZh = language === 'zh';
  const [flowlineCount, setFlowlineCount] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/data/flowline-catalog.json')
      .then((response) => response.json())
      .then((catalog: unknown) => {
        if (!isMounted || !Array.isArray(catalog)) return;
        setFlowlineCount(catalog.length);
      })
      .catch(() => {
        if (!isMounted) return;
        setFlowlineCount(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const explorerDesc = flowlineCount
    ? `Browse ${flowlineCount} Antarctic flow lines on an interactive map. Pick any glacier and simulate its dynamics.`
    : 'Browse Antarctic flow lines on an interactive map. Pick any glacier and simulate its dynamics.';
  const explorerDescZh = flowlineCount
    ? `在交互地图上浏览 ${flowlineCount} 条南极冰流线。选择任意冰川，模拟其动力学过程。`
    : '在交互地图上浏览南极冰流线。选择任意冰川，模拟其动力学过程。';

  const modes: {
    key: GameMode;
    title: string;
    titleZh: string;
    desc: string;
    descZh: string;
    variant: 'blue' | 'amber' | 'teal' | 'purple';
  }[] = [
    {
      key: 'sandbox',
      title: 'Sandbox',
      titleZh: '\u6c99\u76d2\u6a21\u5f0f',
      desc: 'Free exploration. Adjust climate parameters and watch the ice sheet respond in real time.',
      descZh: '\u81ea\u7531\u63a2\u7d22\u3002\u8c03\u8282\u6c14\u5019\u53c2\u6570\uff0c\u5b9e\u65f6\u89c2\u5bdf\u51b0\u76d6\u54cd\u5e94\u3002',
      variant: 'blue',
    },
    {
      key: 'challenge',
      title: 'Challenges',
      titleZh: '\u6311\u6218\u5173\u5361',
      desc: '8 levels, each teaching a key concept: mass balance, MISI, buttressing, hydrology, and more.',
      descZh: '8\u4e2a\u5173\u5361\uff0c\u6bcf\u4e2a\u805a\u7126\u4e00\u4e2a\u5173\u952e\u6982\u5ff5\uff1a\u8d28\u91cf\u5e73\u8861\u3001MISI\u3001\u652f\u6491\u6548\u5e94\u3001\u6c34\u6587\u7b49\u3002',
      variant: 'amber',
    },
    {
      key: 'real_world',
      title: 'Real World',
      titleZh: '\u771f\u5b9e\u4e16\u754c',
      desc: 'Simulate real Antarctic regions: Wilkes Basin, Thwaites Glacier, Totten Glacier.',
      descZh: '\u6a21\u62df\u771f\u5b9e\u5357\u6781\u533a\u57df\uff1a\u5a01\u5c14\u514b\u65af\u76c6\u5730\u3001\u601d\u97e6\u8328\u51b0\u5ddd\u3001\u6258\u6ee5\u51b0\u5ddd\u3002',
      variant: 'teal',
    },
    {
      key: 'explorer',
      title: '3D-ICE Explorer',
      titleZh: '3D-ICE \u63a2\u7d22\u5668',
      desc: explorerDesc,
      descZh: explorerDescZh,
      variant: 'purple',
    },
  ];

  const variantStyles: Record<string, { bg: string; border: string; glow: string }> = {
    blue: { bg: 'var(--card-accent-blue)', border: 'var(--card-border-blue)', glow: 'rgba(74, 144, 168, 0.25)' },
    amber: { bg: 'var(--card-accent-amber)', border: 'var(--card-border-amber)', glow: 'rgba(212, 133, 58, 0.25)' },
    teal: { bg: 'var(--card-accent-teal)', border: 'var(--card-border-teal)', glow: 'rgba(61, 139, 110, 0.25)' },
    purple: { bg: 'var(--card-accent-purple)', border: 'var(--card-border-purple)', glow: 'rgba(139, 92, 196, 0.25)' },
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full p-8 overflow-hidden">
      {/* Top-right controls */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <ThemeToggle />
        <button onClick={toggleLanguage} className="pill-btn">
          {language === 'en' ? '\u4e2d\u6587' : 'EN'}
        </button>
      </div>

      {/* Logo + subtitle */}
      <div className="text-center mb-14 animate-in">
        <img
          src={theme === 'dark' ? '/SL-ICE logo dark.png' : '/SL-ICE logo light.png'}
          alt="SL-ICE"
          className="max-w-xs md:max-w-sm h-auto mx-auto mb-4 animate-breathe"
          draggable={false}
        />
        <p
          className="text-sm max-w-xl mx-auto leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {isZh
            ? '\u57fa\u4e8e Blatter-Pattyn \u9ad8\u9636\u5e94\u529b\u6a21\u578b\u7684\u5b9e\u65f6\u51b0\u76d6\u7269\u7406\u6a21\u62df\u5668\u3002\u8c03\u8282\u6c14\u5019\u53c2\u6570\uff0c\u4eb2\u624b\u4f53\u9a8c\u51b0\u76d6\u7684\u751f\u957f\u3001\u9000\u7f29\u548c\u4e0d\u53ef\u9006\u5d29\u587e\u3002'
            : 'A real-time ice sheet physics simulator based on the Blatter-Pattyn higher-order stress model.'}
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl w-full">
        {modes.map(({ key, title, titleZh, desc, descZh, variant }) => {
          const vs = variantStyles[variant];
          const Icon = modeIcons[key];
          return (
            <button
              key={key}
              onClick={() => setMode(key)}
              className="glass-card group text-left p-6 transition-shadow"
              style={{
                background: vs.bg,
                borderColor: vs.border,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 28px ${vs.glow}, var(--shadow-md)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '';
              }}
            >
              {Icon && (
                <div
                  className="mb-3 opacity-50 group-hover:opacity-80 transition-opacity"
                  style={{ color: vs.border }}
                >
                  <Icon />
                </div>
              )}
              <h2 className="text-lg font-semibold mb-2 group-hover:text-[var(--accent)] transition-colors" style={{ color: 'var(--text-primary)' }}>
                {isZh ? titleZh : title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {isZh ? descZh : desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-14 text-center font-data" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
        <p>Blatter-Pattyn Higher-Order Ice Sheet Model</p>
        <p className="mt-1">Yu Wang &middot; 2026</p>
      </div>
    </div>
  );
}
