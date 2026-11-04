/**
 * Main-thread terrain loading: fetch the binary grids and colormap, then build
 * every mesh in the geometry worker.
 *
 * Abortable (the explorer aborts on unmount, which also terminates the
 * worker) and time-limited; every failure is reported as a TerrainLoadError
 * whose `kind` drives the bilingual message in the loading overlay.
 */

import { BASE } from '../../base';
import { parseDatasetMeta, type DatasetMeta } from './binary-decoder';
import { loadGmtReliefColormap } from './colormap-loader';
import type {
  ExplorerTerrain,
  TerrainBuildRequest,
  TerrainBuildStep,
  TerrainLoadStep,
  TerrainWorkerMessage,
} from './terrain-types';

const DATA_DIR = `${BASE}/3d-ice/data`;

export const TERRAIN_ASSETS = {
  bedMeta: `${DATA_DIR}/bedmachine_antarctica_v4_480.meta.json`,
  bedBin: `${DATA_DIR}/bedmachine_antarctica_v4_480.bin`,
  velocityMeta: `${DATA_DIR}/antarctic_ice_velocity_phase_v01_480.meta.json`,
  velocityBin: `${DATA_DIR}/antarctic_ice_velocity_phase_v01_480.bin`,
} as const;

/** Budget for the whole pipeline (~5 MB of downloads plus the worker build). */
export const TERRAIN_LOAD_TIMEOUT_MS = 120_000;

/** Overall progress milestones (0–1) shown by the loading overlay. */
export const LOAD_PROGRESS = {
  fetch: 0.05,
  parse: 0.2,
  buildStart: 0.3,
  buildSpan: 0.6,
} as const;

export type TerrainErrorKind = 'network' | 'timeout' | 'data' | 'build';

export class TerrainLoadError extends Error {
  readonly kind: TerrainErrorKind;

  constructor(kind: TerrainErrorKind, message: string) {
    super(message);
    this.name = 'TerrainLoadError';
    this.kind = kind;
  }
}

export interface LoadTerrainOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onProgress?: (progress: number, step: TerrainLoadStep) => void;
}

/**
 * Map worker build progress (0–1) into the overall range after downloads, so
 * the bar never moves backwards (the worker restarts its own count at 0.1).
 */
export function mapBuildProgress(workerProgress: number): number {
  const p = Number.isFinite(workerProgress) ? Math.max(0, Math.min(1, workerProgress)) : 0;
  return LOAD_PROGRESS.buildStart + LOAD_PROGRESS.buildSpan * p;
}

// ── Abort / timeout plumbing ─────────────────────────────────────────

interface Deadline {
  readonly signal: AbortSignal;
  timedOut(): boolean;
  /** Stop the timer and abort anything still in flight (e.g. sibling downloads after a failure). */
  dispose(): void;
}

function createDeadline(parent: AbortSignal | undefined, timeoutMs: number): Deadline {
  const controller = new AbortController();
  let expired = false;
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener('abort', abortFromParent, { once: true });

  const timer = setTimeout(() => {
    expired = true;
    controller.abort(new DOMException('Terrain loading timed out', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abortFromParent);
      if (!controller.signal.aborted) controller.abort();
    },
  };
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Terrain loading was aborted', 'AbortError');
}

// ── Downloads ────────────────────────────────────────────────────────

function assetName(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

async function fetchAsset(url: string, signal: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) throw abortReason(signal);
    throw new TerrainLoadError('network', `Could not download ${assetName(url)}: ${String(error)}`);
  }
  if (!response.ok) {
    throw new TerrainLoadError('network', `HTTP ${response.status} while downloading ${assetName(url)}`);
  }
  return response;
}

async function readBody<T>(read: () => Promise<T>, url: string, signal: AbortSignal): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (signal.aborted) throw abortReason(signal);
    const kind: TerrainErrorKind = error instanceof SyntaxError ? 'data' : 'network';
    throw new TerrainLoadError(kind, `Could not read ${assetName(url)}: ${String(error)}`);
  }
}

function parseMeta(value: unknown, label: string): DatasetMeta {
  try {
    return parseDatasetMeta(value, label);
  } catch (error) {
    throw new TerrainLoadError('data', error instanceof Error ? error.message : String(error));
  }
}

async function fetchBuildRequest(
  signal: AbortSignal,
  report: (progress: number, step: TerrainLoadStep) => void,
): Promise<TerrainBuildRequest> {
  const colormap = loadGmtReliefColormap(undefined, { signal }).catch((error: unknown) => {
    if (signal.aborted) throw abortReason(signal);
    throw new TerrainLoadError('network', `Could not load the relief colormap: ${String(error)}`);
  });
  const [bedMetaRes, bedBinRes, velMetaRes, velBinRes, colorTable] = await Promise.all([
    fetchAsset(TERRAIN_ASSETS.bedMeta, signal),
    fetchAsset(TERRAIN_ASSETS.bedBin, signal),
    fetchAsset(TERRAIN_ASSETS.velocityMeta, signal),
    fetchAsset(TERRAIN_ASSETS.velocityBin, signal),
    colormap,
  ]);

  report(LOAD_PROGRESS.parse, 'parse');
  const [bedMetaJson, bedBuffer, velMetaJson, velocityBuffer] = await Promise.all([
    readBody(() => bedMetaRes.json() as Promise<unknown>, TERRAIN_ASSETS.bedMeta, signal),
    readBody(() => bedBinRes.arrayBuffer(), TERRAIN_ASSETS.bedBin, signal),
    readBody(() => velMetaRes.json() as Promise<unknown>, TERRAIN_ASSETS.velocityMeta, signal),
    readBody(() => velBinRes.arrayBuffer(), TERRAIN_ASSETS.velocityBin, signal),
  ]);

  return {
    type: 'buildAll',
    bedMeta: parseMeta(bedMetaJson, 'BedMachine'),
    bedBuffer,
    velocityMeta: parseMeta(velMetaJson, 'Velocity'),
    velocityBuffer,
    oceanLut: colorTable.ocean,
    landLut: colorTable.land,
  };
}

// ── Geometry worker ──────────────────────────────────────────────────

function runGeometryWorker(
  request: TerrainBuildRequest,
  signal: AbortSignal,
  onProgress: (step: TerrainBuildStep, progress: number) => void,
): Promise<ExplorerTerrain> {
  return new Promise<ExplorerTerrain>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(new TerrainLoadError('build', `Could not start the terrain worker: ${String(error)}`));
      return;
    }

    const settle = (outcome: () => void) => {
      worker.terminate();
      signal.removeEventListener('abort', onAbort);
      outcome();
    };
    const onAbort = () => settle(() => reject(abortReason(signal)));
    signal.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<TerrainWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress(message.step, message.progress);
      } else if (message.type === 'result') {
        settle(() => resolve(message.terrain));
      } else {
        settle(() => reject(new TerrainLoadError('build', message.message)));
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      settle(() => reject(new TerrainLoadError('build', event.message || 'The terrain worker crashed')));
    };
    worker.onmessageerror = () => {
      settle(() => reject(new TerrainLoadError('build', 'The terrain worker sent a message that could not be read')));
    };

    worker.postMessage(request, [request.bedBuffer, request.velocityBuffer]);
  });
}

// ── Public API ───────────────────────────────────────────────────────

/** Download and build the explorer terrain. Rejects with TerrainLoadError (or the abort reason). */
export async function loadTerrain(options: LoadTerrainOptions = {}): Promise<ExplorerTerrain> {
  const deadline = createDeadline(options.signal, options.timeoutMs ?? TERRAIN_LOAD_TIMEOUT_MS);
  const report = options.onProgress ?? (() => undefined);

  try {
    report(LOAD_PROGRESS.fetch, 'fetch');
    const request = await fetchBuildRequest(deadline.signal, report);
    report(LOAD_PROGRESS.buildStart, 'decode');
    return await runGeometryWorker(request, deadline.signal, (step, progress) => {
      report(mapBuildProgress(progress), step);
    });
  } catch (error) {
    if (deadline.timedOut()) {
      throw new TerrainLoadError('timeout', `Terrain loading timed out after ${Math.round((options.timeoutMs ?? TERRAIN_LOAD_TIMEOUT_MS) / 1000)} s`);
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}
