/**
 * Challenge briefing screen shown before a challenge starts.
 * Typewriter effect for narrative immersion, skippable.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../store/ui-store';
import { getNarrative } from '../../challenges/narrative';
import { challenges } from '../../challenges';

interface ChallengeBriefingProps {
  challengeId: number;
  onStart: () => void;
  onCancel: () => void;
}

export default function ChallengeBriefing({ challengeId, onStart, onCancel }: ChallengeBriefingProps) {
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const narrative = getNarrative(challengeId);
  const challenge = challenges.find((c) => c.id === challengeId);
  const fullText = narrative ? (isZh ? narrative.briefing_zh : narrative.briefing_en) : '';

  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const frameRef = useRef(0);

  // Typewriter effect
  useEffect(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(frameRef.current);

    if (!fullText) {
      frameRef.current = requestAnimationFrame(() => {
        setDisplayedText('');
        setIsComplete(true);
      });
      return () => cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      indexRef.current = 0;
      setDisplayedText('');
      setIsComplete(false);

      timerRef.current = setInterval(() => {
        indexRef.current += 1;
        if (indexRef.current >= fullText.length) {
          setDisplayedText(fullText);
          setIsComplete(true);
          clearInterval(timerRef.current);
        } else {
          setDisplayedText(fullText.slice(0, indexRef.current));
        }
      }, 25); // 25ms per character
    });

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(timerRef.current);
    };
  }, [fullText]);

  const handleSkip = useCallback(() => {
    clearInterval(timerRef.current);
    setDisplayedText(fullText);
    setIsComplete(true);
  }, [fullText]);

  if (!challenge) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="glass-panel rounded-2xl p-8 max-w-lg w-full mx-4"
        style={{ animation: 'ghibli-fade-in 0.4s ease-out' }}
      >
        {/* Challenge header */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="font-data text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isZh ? `挑战 ${challengeId}` : `Challenge ${challengeId}`}
          </span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isZh ? challenge.name_zh : challenge.name_en}
          </h2>
        </div>

        {/* Narrative text with typewriter */}
        <div
          className="text-sm leading-relaxed mb-6 min-h-[120px] whitespace-pre-line"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
        >
          {displayedText}
          {!isComplete && (
            <span className="inline-block w-[2px] h-[1em] ml-0.5 align-middle" style={{ background: 'var(--accent)', animation: 'gentle-breathe 1s ease-in-out infinite' }} />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="pill-btn text-sm"
          >
            {isZh ? '返回' : 'Back'}
          </button>
          {!isComplete && (
            <button
              onClick={handleSkip}
              className="pill-btn text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              {isZh ? '跳过' : 'Skip'}
            </button>
          )}
          <button
            onClick={onStart}
            className="pill-btn text-sm flex-1"
            style={{
              background: isComplete ? 'var(--accent)' : 'var(--bg-secondary)',
              color: isComplete ? 'white' : 'var(--text-muted)',
              borderColor: isComplete ? 'var(--accent)' : undefined,
              transition: 'all 0.3s ease',
            }}
          >
            {isZh ? '开始挑战' : 'Begin Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}
