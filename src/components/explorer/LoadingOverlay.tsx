/**
 * Loading overlay shown while terrain data is fetched and built, and while the
 * scene's shaders are pre-compiled. On failure it explains what went wrong
 * (bilingual) and offers a retry.
 */

import { useExplorerStore } from '../../store/explorer-store';
import { useUIStore } from '../../store/ui-store';
import type { TerrainErrorKind } from '../../lib/terrain/terrain-loader';
import type { TerrainLoadStep } from '../../lib/terrain/terrain-types';

type Bilingual = readonly [en: string, zh: string];

const STEP_LABELS: Record<TerrainLoadStep | 'warmup', Bilingual> = {
  fetch: ['Fetching terrain data...', '正在下载地形数据...'],
  parse: ['Decoding binary data...', '正在解码二进制数据...'],
  decode: ['Decoding terrain...', '正在解码地形...'],
  bedrock: ['Building bedrock...', '正在构建基岩...'],
  'ice-surface': ['Building ice surface...', '正在构建冰面...'],
  'ice-bottom': ['Building ice bottom...', '正在构建冰底...'],
  'ice-sides': ['Building ice side walls...', '正在构建冰盖侧壁...'],
  velocity: ['Building velocity overlay...', '正在构建流速图层...'],
  finalize: ['Finalizing...', '即将完成...'],
  warmup: ['Preparing 3D scene...', '正在准备三维场景...'],
};

const ERROR_LABELS: Record<TerrainErrorKind, Bilingual> = {
  network: [
    'The terrain data could not be downloaded. Check your connection and try again.',
    '无法下载地形数据，请检查网络连接后重试。',
  ],
  timeout: ['Downloading the terrain data took too long.', '地形数据下载超时。'],
  data: ['The terrain data is damaged or in an unexpected format.', '地形数据已损坏或格式不正确。'],
  build: ['Building the 3D terrain failed.', '三维地形构建失败。'],
};

/** Progress shown while shaders compile (data is complete by then). */
const WARMUP_PROGRESS = 0.95;

interface LoadingOverlayProps {
  /** Terrain data is ready and the scene is pre-compiling its shaders. */
  warming: boolean;
}

function pick(label: Bilingual, isZh: boolean): string {
  return isZh ? label[1] : label[0];
}

function LoadError({ isZh }: { isZh: boolean }) {
  const loadError = useExplorerStore((s) => s.loadError);
  const retryLoading = useExplorerStore((s) => s.retryLoading);

  return (
    <>
      <div className="text-red-400 text-sm font-medium">
        {isZh ? '加载失败' : 'Loading Failed'}
      </div>
      <div className="text-red-200 text-xs max-w-xs text-center">
        {pick(ERROR_LABELS[loadError?.kind ?? 'build'], isZh)}
      </div>
      {loadError?.detail && (
        <div className="text-red-300/70 text-[10px] max-w-xs text-center font-mono break-words">
          {loadError.detail}
        </div>
      )}
      <button
        onClick={retryLoading}
        className="pill-btn px-4 py-1.5 text-xs font-medium"
        style={{
          background: 'rgba(56, 189, 248, 0.2)',
          borderColor: 'rgba(56, 189, 248, 0.6)',
          color: '#e0f2fe',
        }}
      >
        {isZh ? '重试' : 'Retry'}
      </button>
    </>
  );
}

export default function LoadingOverlay({ warming }: LoadingOverlayProps) {
  const loadingStage = useExplorerStore((s) => s.loadingStage);
  const loadingProgress = useExplorerStore((s) => s.loadingProgress);
  const loadingStep = useExplorerStore((s) => s.loadingStep);
  const isZh = useUIStore((s) => s.language) === 'zh';

  const progress = warming ? WARMUP_PROGRESS : loadingProgress;
  const step = warming ? 'warmup' : loadingStep;
  const label = step
    ? pick(STEP_LABELS[step], isZh)
    : (isZh ? '正在加载地形数据...' : 'Loading terrain data...');

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
      style={{ background: 'rgba(10, 43, 67, 0.92)' }}
      role="status"
      aria-live="polite"
    >
      {loadingStage === 'error' && !warming ? (
        <LoadError isZh={isZh} />
      ) : (
        <>
          {/* Progress bar */}
          <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div
              className="h-full rounded-full transition-transform duration-300 ease-out origin-left"
              style={{
                background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                transform: `scaleX(${progress})`,
              }}
            />
          </div>

          <div className="text-center">
            <div className="text-white/80 text-xs font-medium">{label}</div>
            <div className="text-white/50 text-[10px] mt-1 font-mono">{Math.round(progress * 100)}%</div>
          </div>
        </>
      )}
    </div>
  );
}
