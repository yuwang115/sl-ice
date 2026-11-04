/**
 * Per-state derived data for the 2D canvas (node x positions, floating mask,
 * elevation range). Computed once per physics state object instead of every
 * animation frame — the state only changes when the solver posts a new step.
 */

import type { PhysicsStatePayload } from '../engine/types';

export interface FrameGeometry {
  readonly domainLengthM: number;
  readonly xPositions: Float64Array;
  readonly isFloating: Uint8Array;
  /** Grounding-line position (m). */
  readonly glPositionM: number;
  readonly zMin: number;
  readonly zMax: number;
}

const DEFAULT_Z_MIN = -1500;
const DEFAULT_Z_MAX = 4000;

/** Evenly spaced node positions (m) from 0 to the domain length. */
export function computeXPositions(domainLengthM: number, nx: number): Float64Array {
  const positions = new Float64Array(nx);
  const dx = domainLengthM / (nx - 1);
  for (let i = 0; i < nx; i++) positions[i] = i * dx;
  return positions;
}

/** Vertical plot range: 200 m below the deepest bed to ≥ 500 m above the highest surface. */
export function computeElevationRange(
  b: Float64Array | undefined,
  s: Float64Array | undefined,
): { zMin: number; zMax: number } {
  if (!b || !s) return { zMin: DEFAULT_Z_MIN, zMax: DEFAULT_Z_MAX };
  let minB = 0;
  let maxS = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] < minB) minB = b[i];
    if (s[i] > maxS) maxS = s[i];
  }
  return { zMin: minB - 200, zMax: Math.max(maxS + 500, 500) };
}

/** 1 where a node lies seaward of the grounding line and carries ice (> 10 m). */
export function computeFloatingMask(H: Float64Array, xPositions: Float64Array, glPositionM: number): Uint8Array {
  const mask = new Uint8Array(H.length);
  for (let i = 0; i < H.length; i++) {
    mask[i] = xPositions[i] > glPositionM && H[i] > 10 ? 1 : 0;
  }
  return mask;
}

let positionsCache: { readonly key: string; readonly positions: Float64Array } | null = null;
let geometryCache: {
  readonly state: PhysicsStatePayload;
  readonly domainLengthM: number;
  readonly geometry: FrameGeometry;
} | null = null;

function cachedXPositions(domainLengthM: number, nx: number): Float64Array {
  const key = `${domainLengthM}:${nx}`;
  if (positionsCache?.key !== key) {
    positionsCache = { key, positions: computeXPositions(domainLengthM, nx) };
  }
  return positionsCache.positions;
}

/** Derived geometry for `state`, memoized on the state object and domain length. */
export function getFrameGeometry(state: PhysicsStatePayload, domainLengthKm: number): FrameGeometry {
  const domainLengthM = domainLengthKm * 1000;
  if (geometryCache?.state === state && geometryCache.domainLengthM === domainLengthM) {
    return geometryCache.geometry;
  }

  const xPositions = cachedXPositions(domainLengthM, state.H.length);
  const glPositionM = state.gl_position * 1000;
  const geometry: FrameGeometry = {
    domainLengthM,
    xPositions,
    isFloating: computeFloatingMask(state.H, xPositions, glPositionM),
    glPositionM,
    ...computeElevationRange(state.b, state.s),
  };
  geometryCache = { state, domainLengthM, geometry };
  return geometry;
}

export function resetFrameGeometryCache(): void {
  positionsCache = null;
  geometryCache = null;
}
