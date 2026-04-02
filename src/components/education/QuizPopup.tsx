/**
 * Quiz popup triggered by physics events.
 * Pauses simulation, asks a multiple-choice question, shows explanation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import { getQuizForEvent, type QuizQuestion } from '../../challenges/quizzes';

export default function QuizPopup() {
  const currentChallenge = useGameStore((s) => s.currentChallenge);
  const events = usePhysicsStore((s) => s.events);
  const setRunning = useGameStore((s) => s.setRunning);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const [activeQuiz, setActiveQuiz] = useState<QuizQuestion | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const answeredRef = useRef<Set<string>>(new Set());
  const wasRunningRef = useRef(false);

  // Watch for triggering events
  useEffect(() => {
    if (!currentChallenge || activeQuiz) return;

    for (const event of events) {
      const quiz = getQuizForEvent(event.type, answeredRef.current);
      if (quiz) {
        // Pause simulation
        wasRunningRef.current = useGameStore.getState().isRunning;
        setRunning(false);

        setActiveQuiz(quiz);
        setSelectedIndex(null);
        setShowExplanation(false);
        answeredRef.current.add(quiz.trigger);
        break;
      }
    }
  }, [events, currentChallenge, activeQuiz, setRunning]);

  // Reset answered set when challenge changes
  useEffect(() => {
    answeredRef.current = new Set();
  }, [currentChallenge]);

  const handleSelect = useCallback((index: number) => {
    if (selectedIndex !== null) return; // Already answered
    setSelectedIndex(index);
    setShowExplanation(true);
  }, [selectedIndex]);

  const handleDismiss = useCallback(() => {
    setActiveQuiz(null);
    // Resume simulation if it was running
    if (wasRunningRef.current) {
      setRunning(true);
    }
  }, [setRunning]);

  if (!activeQuiz) return null;

  const correctIndex = activeQuiz.options.findIndex((o) => o.correct);
  const isCorrect = selectedIndex === correctIndex;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="glass-panel rounded-2xl p-6 max-w-lg w-full mx-4"
        style={{ animation: 'ghibli-fade-in 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🧊</span>
          <span
            className="text-[10px] font-data uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {isZh ? '知识检查' : 'Knowledge Check'}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {isZh ? activeQuiz.question_zh : activeQuiz.question_en}
        </h3>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {activeQuiz.options.map((option, i) => {
            const isSelected = selectedIndex === i;
            const isOptionCorrect = option.correct;
            const showResult = showExplanation;

            let borderColor = 'var(--border-default)';
            let bg = 'transparent';
            if (showResult && isOptionCorrect) {
              borderColor = 'var(--accent-teal)';
              bg = 'rgba(74, 144, 168, 0.1)';
            } else if (showResult && isSelected && !isOptionCorrect) {
              borderColor = 'var(--accent-danger)';
              bg = 'rgba(196, 80, 80, 0.1)';
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={showExplanation}
                className="w-full text-left text-xs p-3 rounded-lg border transition-all"
                style={{
                  borderColor,
                  background: bg,
                  cursor: showExplanation ? 'default' : 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="font-data mr-2" style={{ color: 'var(--text-muted)' }}>
                  {String.fromCharCode(65 + i)})
                </span>
                {isZh ? option.zh : option.en}
                {showResult && isOptionCorrect && (
                  <span className="ml-2" style={{ color: 'var(--accent-teal)' }}>✓</span>
                )}
                {showResult && isSelected && !isOptionCorrect && (
                  <span className="ml-2" style={{ color: 'var(--accent-danger)' }}>✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div
            className="rounded-lg p-3 mb-4 text-xs leading-relaxed animate-in"
            style={{
              background: 'var(--bg-secondary)',
              borderLeft: `3px solid ${isCorrect ? 'var(--accent-teal)' : 'var(--accent-warm)'}`,
            }}
          >
            <div className="font-semibold mb-1" style={{ color: isCorrect ? 'var(--accent-teal)' : 'var(--accent-warm)' }}>
              {isCorrect
                ? (isZh ? '正确！' : 'Correct!')
                : (isZh ? '不完全正确' : 'Not quite right')}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isZh ? activeQuiz.explanation_zh : activeQuiz.explanation_en}
            </p>
          </div>
        )}

        {/* Continue button */}
        {showExplanation && (
          <button
            onClick={handleDismiss}
            className="pill-btn text-sm w-full"
            style={{ background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' }}
          >
            {isZh ? '继续模拟' : 'Continue Simulation'}
          </button>
        )}
      </div>
    </div>
  );
}
