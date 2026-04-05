import { useState, useCallback } from 'react';
import { useTheme } from './hooks/useTheme';
import { useScrollReveal } from './hooks/useScrollReveal';
import { HeroSection } from './components/HeroSection';
import { DemoSection } from './components/DemoSection';
import { FeatureCards } from './components/FeatureCards';
import { ChallengeShowcase } from './components/ChallengeShowcase';
import { TechHighlights } from './components/TechHighlights';
import { EducationSection } from './components/EducationSection';
import { CallToAction } from './components/CallToAction';
import { Footer } from './components/Footer';

export function LandingPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [lang, setLang] = useState<'en' | 'zh'>('en');
  const containerRef = useScrollReveal();

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'zh' : 'en'));
  }, []);

  return (
    <div ref={containerRef}>
      {/* Fixed top-right controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="pill-btn"
          style={{ padding: '6px 12px' }}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <button
          onClick={toggleLang}
          className="pill-btn"
          style={{ padding: '6px 12px', fontSize: '11px' }}
        >
          {lang === 'en' ? '\u4E2D\u6587' : 'EN'}
        </button>
      </div>

      <HeroSection lang={lang} theme={theme} />
      <DemoSection lang={lang} />
      <FeatureCards lang={lang} />
      <ChallengeShowcase lang={lang} />
      <TechHighlights lang={lang} />
      <EducationSection lang={lang} />
      <CallToAction lang={lang} />
      <Footer
        lang={lang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleLang={toggleLang}
      />
    </div>
  );
}
