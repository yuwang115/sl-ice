/**
 * Main application component.
 * Orchestrates game loop, connects physics worker to rendering.
 */

import { useEffect, useRef, lazy, Suspense } from 'react';
import { usePhysicsStore } from './store/physics-store';
import { useGameStore } from './store/game-store';
import { useUIStore } from './store/ui-store';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/layout/Dashboard';
import ChallengePanel from './components/game/ChallengePanel';
import RealWorldSelector from './components/game/RealWorldSelector';
import IceSheetCanvas from './renderer/IceSheetCanvas';
import InfoBubble from './components/education/InfoBubble';
import QuizPopup from './components/education/QuizPopup';
import TransitionOverlay from './components/explorer/TransitionOverlay';
import HintPanel from './components/game/HintPanel';
import AchievementToast from './components/game/AchievementToast';
import { PageSkeleton } from './components/ui/Skeleton';
import { useAchievementChecker } from './hooks/useAchievementChecker';

/** Fetch with retry (exponential backoff) */
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error('Fetch failed');
}

// Lazy-load the 3D explorer (Three.js is ~700KB) to keep initial bundle small
const AntarcticaExplorer = lazy(() => import('./components/game/AntarcticaExplorer'));

function App() {
  // Achievement tracking
  useAchievementChecker();

  // Initialize theme from system preference
  const initTheme = useUIStore((s) => s.initTheme);
  const themeInitedRef = useRef(false);
  useEffect(() => {
    if (!themeInitedRef.current) {
      themeInitedRef.current = true;
      initTheme();
    }
  }, [initTheme]);

  // Use individual selectors to avoid unnecessary re-renders
  const mode = useGameStore((s) => s.mode);
  const isRunning = useGameStore((s) => s.isRunning);
  const stepsPerFrame = useGameStore((s) => s.stepsPerFrame);
  const params = useGameStore((s) => s.params);
  const currentChallenge = useGameStore((s) => s.currentChallenge);
  const selectedRegion = useGameStore((s) => s.selectedRegion);
  const selectedFlowline = useGameStore((s) => s.selectedFlowline);

  const initWorker = usePhysicsStore((s) => s.initWorker);
  const loadScenario = usePhysicsStore((s) => s.loadScenario);
  const updateParams = usePhysicsStore((s) => s.updateParams);
  const step = usePhysicsStore((s) => s.step);
  const isInitialized = usePhysicsStore((s) => s.isInitialized);
  const destroyWorker = usePhysicsStore((s) => s.destroyWorker);
  const workerInitedRef = useRef(false);

  // Initialize worker on mount (only once)
  useEffect(() => {
    if (!workerInitedRef.current) {
      workerInitedRef.current = true;
      initWorker();
    }
    return () => {
      destroyWorker();
      workerInitedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRunning = useGameStore((s) => s.setRunning);

  // Load default scenario when entering sandbox mode
  useEffect(() => {
    if (mode === 'sandbox') {
      fetchWithRetry('/data/scenarios/scenario_b_misi.json')
        .then((r) => r.json())
        .then((config) => {
          loadScenario(config);
          setRunning(true);
        })
        .catch((err) => console.error('Failed to load scenario:', err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Sync params to worker
  useEffect(() => {
    if (isInitialized) {
      updateParams(params);
    }
  }, [params, isInitialized, updateParams]);

  // Challenge evaluation: subscribe to physics state updates
  const evaluateChallenge = useGameStore((s) => s.evaluateChallenge);
  const evaluateChallengeRef = useRef(evaluateChallenge);
  useEffect(() => { evaluateChallengeRef.current = evaluateChallenge; }, [evaluateChallenge]);

  const physicsState = usePhysicsStore((s) => s.state);
  useEffect(() => {
    if (physicsState && currentChallenge) {
      evaluateChallengeRef.current(physicsState);
    }
  }, [physicsState, currentChallenge]);

  // Track parameter changes during challenges
  const incrementParamChanges = useGameStore((s) => s.incrementParamChanges);
  const prevParamsRef = useRef(params);
  useEffect(() => {
    if (currentChallenge && prevParamsRef.current !== params) {
      incrementParamChanges();
    }
    prevParamsRef.current = params;
  }, [params, currentChallenge, incrementParamChanges]);

  // Game loop using refs to avoid stale closures
  const isRunningRef = useRef(isRunning);
  const isInitializedRef = useRef(isInitialized);
  const stepsPerFrameRef = useRef(stepsPerFrame);
  const stepRef = useRef(step);

  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isInitializedRef.current = isInitialized; }, [isInitialized]);
  useEffect(() => { stepsPerFrameRef.current = stepsPerFrame; }, [stepsPerFrame]);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Track mode to pause physics when in explorer without a flowline selected
  const modeRef = useRef(mode);
  const selectedFlowlineRef = useRef(selectedFlowline);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { selectedFlowlineRef.current = selectedFlowline; }, [selectedFlowline]);

  useEffect(() => {
    let frameId = 0;

    const tick = () => {
      // Skip physics when viewing the 3D-ICE explorer (heavy WebGL iframe)
      if (modeRef.current !== 'explorer' || selectedFlowlineRef.current) {
        if (isRunningRef.current && isInitializedRef.current && stepsPerFrameRef.current > 0) {
          stepRef.current(0.1, stepsPerFrameRef.current);
        }
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Global transition overlay (persists across explorer → simulation unmount)
  const transitionOverlay = <TransitionOverlay />;

  const challengeResult = useGameStore((s) => s.challengeResult);

  // Challenge selection (not yet started) or result screen
  if (mode === 'challenge' && !currentChallenge && !challengeResult) {
    return <ChallengePanel />;
  }
  // Challenge result overlay (full-screen)
  if (challengeResult) {
    return <ChallengePanel />;
  }

  // Real World region selection
  if (mode === 'real_world' && !selectedRegion) {
    return <RealWorldSelector />;
  }

  // 3D-ICE Explorer as the landing page (lazy-loaded with Three.js)
  if ((mode === 'explorer' || mode === 'menu') && !selectedFlowline) {
    return (
      <>
        {transitionOverlay}
        <Suspense fallback={<PageSkeleton />}>
          <AntarcticaExplorer />
        </Suspense>
      </>
    );
  }

  // Main simulation view
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {transitionOverlay}
      <AchievementToast />
      <Header />

      <div className="flex-1 flex min-h-0">
        {/* Canvas area */}
        <main className="flex-1 relative min-w-0 overflow-hidden" role="main" aria-label="Ice sheet simulation">
          <IceSheetCanvas />
          <Dashboard />
          <InfoBubble />

          {/* Challenge overlay */}
          {mode === 'challenge' && currentChallenge && (
            <>
              <ChallengePanel />
              <HintPanel />
              <QuizPopup />
            </>
          )}
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  );
}

export default App;
