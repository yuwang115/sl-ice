/**
 * Web Worker for terrain geometry generation.
 * Decodes the binary grids and builds every mesh (including vertex normals)
 * and the velocity texture data off the main thread; results are transferred
 * (zero-copy) back. The pipeline itself lives in `terrain-build.ts`.
 */

import { buildTerrain } from './terrain-build';
import {
  collectTerrainTransferables,
  type TerrainBuildRequest,
  type TerrainWorkerMessage,
} from './terrain-types';

function post(message: TerrainWorkerMessage, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer });
}

self.onmessage = (event: MessageEvent<TerrainBuildRequest>) => {
  if (event.data?.type !== 'buildAll') return;

  try {
    const terrain = buildTerrain(event.data, (step, progress) => {
      post({ type: 'progress', step, progress });
    });
    post({ type: 'result', terrain }, collectTerrainTransferables(terrain));
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
