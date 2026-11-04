/**
 * Main application component.
 * Orchestrates game loop, connects physics worker to rendering.
 */

import { useEffect, lazy, Suspense } from 'react';
import { usePhysicsStore } from './store/physics-store';
import { selectActiveView, useGameStore } from './store/game-store';
import { useUIStore } from './store/ui-store';

import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/layout/Dashboard';
import ErrorBoundary from './components/layout/ErrorBoundary';
import ExplorerFallback from './components/layout/ExplorerFallback';
import { lazyWithRetry } from './components/layout/lazy-with-retry';
import ChallengePanel from './components/game/ChallengePanel';
import RealWorldSelector from './components/game/RealWorldSelector';
import IceSheetCanvas from './renderer/IceSheetCanvas';
import InfoBubble from './components/education/InfoBubble';
import QuizPopup from './components/education/QuizPopup';
import TransitionOverlay from './components/explorer/TransitionOverlay';
import HintPanel from './components/game/HintPanel';
import AchievementToast from './components/game/AchievementToast';
import { PageSkeleton } from './components/ui/Skeleton';
import SimulationErrorNotices from './components/ui/SimulationErrorNotices';
import { useAchievementChecker } from './hooks/useAchievementChecker';
import { useSandboxScenario } from './hooks/useSandboxScenario';
import { useSimulationBridge } from './hooks/useSimulationBridge';

// Lazy-load the 3D explorer (Three.js is ~700KB) to keep initial bundle small
const AntarcticaExplorer = lazy(lazyWithRetry(() => import('./components/game/AntarcticaExplorer')));

function App() {
  // Achievement tracking
  useAchievementChecker();

  // Apply the saved theme, or follow the system preference
  const initTheme = useUIStore((s) => s.initTheme);
  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // One physics worker for the app's lifetime
  useEffect(() => {
    usePhysicsStore.getState().initWorker();
    return () => usePhysicsStore.getState().destroyWorker();
  }, []);

  // Step loop, param sync and challenge evaluation (store subscriptions, no re-renders)
  useSimulationBridge();
  const retrySandboxLoad = useSandboxScenario();

  const view = useGameStore(selectActiveView);
  const mode = useGameStore((s) => s.mode);

  // Global transition overlay (persists across explorer → simulation unmount)
  const transitionOverlay = <TransitionOverlay />;

  // Challenge selection/briefing and the result screen share one panel instance
  if (view === 'challenge_list' || view === 'challenge_result') {
    return <ChallengePanel />;
  }

  // Real World region selection
  if (view === 'real_world_selector') {
    return <RealWorldSelector />;
  }

  // 3D-ICE Explorer as the landing page (lazy-loaded with Three.js)
  if (view === 'explorer') {
    return (
      <>
        {transitionOverlay}
        <ErrorBoundary fallback={<ExplorerFallback />}>
          <Suspense fallback={<PageSkeleton />}>
            <AntarcticaExplorer />
          </Suspense>
        </ErrorBoundary>
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
          <SimulationErrorNotices onRetryLoad={mode === 'sandbox' ? retrySandboxLoad : undefined} />

          {/* Challenge overlay */}
          {mode === 'challenge' && (
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
