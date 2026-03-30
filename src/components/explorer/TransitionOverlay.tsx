/**
 * Full-screen transition overlay for the 3D-ICE → Simulation "slice" effect.
 *
 * Visual phases:
 *   camera-zoom  →  vignette darkens edges, camera flies toward flowline
 *   slice        →  bright horizontal beam expands from center
 *   fade-out     →  screen blooms to white
 *   complete     →  fully white (view switches underneath)
 *   reveal       →  white fades out, showing the simulation
 *
 * Rendered at App level so it persists across the explorer → simulation unmount.
 */

import { useExplorerStore, type TransitionPhase } from '../../store/explorer-store';

export default function TransitionOverlay() {
  const phase: TransitionPhase = useExplorerStore((s) => s.transitionPhase);
  const isTransitioning = useExplorerStore((s) => s.isTransitioning);

  // Fully idle — render nothing
  if (!isTransitioning && phase === 'idle') return null;

  const showVignette = phase === 'camera-zoom' || phase === 'slice';
  const showSlice = phase === 'slice' || phase === 'fade-out';
  const whiteVisible = phase === 'fade-out' || phase === 'complete';
  const isRevealing = phase === 'reveal';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: phase === 'idle' || phase === 'reveal' ? 'none' : 'all',
        overflow: 'hidden',
      }}
    >
      {/* ── Inline keyframe definitions ────────────────────────── */}
      <style>{`
        @keyframes sliceGrow {
          0%   { transform: scaleY(0);    opacity: 0; }
          8%   { transform: scaleY(0.002); opacity: 1; }
          35%  { transform: scaleY(0.004); }
          100% { transform: scaleY(1);    opacity: 1; }
        }

        @keyframes sliceBoxGlow {
          0%   { box-shadow: 0 0 40px 8px rgba(56,189,248,0.7); }
          50%  { box-shadow: 0 0 80px 25px rgba(56,189,248,0.5),
                             0 0 200px 60px rgba(14,165,233,0.25); }
          100% { box-shadow: 0 0 200px 120px rgba(255,255,255,0.85); }
        }

        @keyframes streakLeft {
          0%   { transform: translateX(0) scaleX(0); opacity: 0; }
          25%  { opacity: 0.6; }
          100% { transform: translateX(-45vw) scaleX(1); opacity: 0; }
        }

        @keyframes streakRight {
          0%   { transform: translateX(0) scaleX(0); opacity: 0; }
          25%  { opacity: 0.6; }
          100% { transform: translateX(45vw) scaleX(1); opacity: 0; }
        }

        @keyframes bloomPulse {
          0%   { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(2.5);  opacity: 0.7; }
        }
      `}</style>

      {/* ── Layer 1: Vignette ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 15%, rgba(2,6,23,0.45) 50%, rgba(2,6,23,0.88) 100%)',
          opacity: showVignette ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* ── Layer 2: Slice beam + light streaks ───────────────── */}
      {showSlice && (
        <>
          {/* Main expanding beam */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.15) 8%, rgba(186,230,253,0.55) 25%, #fff 45%, #fff 55%, rgba(186,230,253,0.55) 75%, rgba(56,189,248,0.15) 92%, transparent 100%)',
              transformOrigin: 'center center',
              animation: 'sliceGrow 0.55s cubic-bezier(0.16,1,0.3,1) forwards, sliceBoxGlow 0.55s ease-out forwards',
            }}
          />

          {/* Horizontal light streaks */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '50vw',
              height: '2px',
              background: 'linear-gradient(90deg, rgba(186,230,253,0.9), transparent)',
              animation: 'streakLeft 0.5s ease-out 0.08s forwards',
              opacity: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '50vw',
              height: '2px',
              background: 'linear-gradient(270deg, rgba(186,230,253,0.9), transparent)',
              animation: 'streakRight 0.5s ease-out 0.08s forwards',
              opacity: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(50% - 4px)',
              left: '50%',
              width: '35vw',
              height: '1px',
              background: 'linear-gradient(90deg, rgba(56,189,248,0.7), transparent)',
              animation: 'streakLeft 0.45s ease-out 0.15s forwards',
              opacity: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(50% + 4px)',
              left: '50%',
              width: '35vw',
              height: '1px',
              background: 'linear-gradient(270deg, rgba(56,189,248,0.7), transparent)',
              animation: 'streakRight 0.45s ease-out 0.15s forwards',
              opacity: 0,
            }}
          />

          {/* Center radial bloom */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '40vmin',
              height: '40vmin',
              marginLeft: '-20vmin',
              marginTop: '-20vmin',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(56,189,248,0.4) 40%, transparent 70%)',
              animation: 'bloomPulse 0.6s ease-out forwards',
            }}
          />
        </>
      )}

      {/* ── Layer 3: White cover ──────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: (whiteVisible || isRevealing)
            ? 'radial-gradient(ellipse at center, #fff 0%, #e0f2fe 50%, #fff 100%)'
            : '#fff',
          opacity: whiteVisible ? 1 : 0,
          transition: isRevealing
            ? 'opacity 0.7s ease-out'
            : whiteVisible
              ? 'opacity 0.35s ease-in'
              : 'none',
        }}
      />
    </div>
  );
}
