/**
 * Scenario-load and physics-worker failures, shown over the simulation view.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import ErrorNotice from './ErrorNotice';

interface SimulationErrorNoticesProps {
  /** Retries the failed scenario load, when the current mode can. */
  onRetryLoad?: () => void;
}

export default function SimulationErrorNotices({ onRetryLoad }: SimulationErrorNoticesProps) {
  const loadError = useGameStore((s) => s.loadError);
  const setLoadError = useGameStore((s) => s.setLoadError);
  const workerError = usePhysicsStore((s) => s.lastError);
  const clearWorkerError = usePhysicsStore((s) => s.clearError);

  if (!loadError && !workerError) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-2 w-full max-w-md px-4">
      {loadError && (
        <ErrorNotice message={loadError} onRetry={onRetryLoad} onDismiss={() => setLoadError(null)} />
      )}
      {workerError && (
        <ErrorNotice
          message={{ en: `Simulation error: ${workerError}`, zh: `模拟出错：${workerError}` }}
          onDismiss={clearWorkerError}
        />
      )}
    </div>
  );
}
