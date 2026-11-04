import { afterEach, describe, expect, it } from 'vitest';

import {
  computeElevationRange,
  computeFloatingMask,
  computeXPositions,
  getFrameGeometry,
  resetFrameGeometryCache,
} from '../../src/renderer/frame-geometry';
import type { PhysicsStatePayload } from '../../src/engine/types';

function makeState(overrides: Partial<PhysicsStatePayload> = {}): PhysicsStatePayload {
  const nx = 5;
  return {
    year: 0,
    H: new Float64Array([1000, 800, 400, 200, 0]),
    u_surface: new Float64Array(nx),
    u_base: new Float64Array(nx),
    s: new Float64Array([1200, 900, 100, 40, 0]),
    b: new Float64Array([200, -100, -600, -900, -1200]),
    ice_base: new Float64Array([200, -100, -300, -160, 0]),
    gl_position: 40, // km
    gl_velocity: 0,
    gl_flux_km3_yr: 0,
    volume: 0,
    mass_change_gt: 0,
    sea_level: 0,
    shelf_exists: true,
    water_pressure: new Float64Array(nx),
    is_misi_active: false,
    cliff_height: 0,
    mici_calving_rate: 0,
    is_mici_active: false,
    events: [],
    smb: new Float64Array(nx),
    u_depth_avg: new Float64Array(nx),
    nx,
    nz: 3,
    dsigma: 0.5,
    ...overrides,
  };
}

afterEach(() => resetFrameGeometryCache());

describe('frame geometry helpers', () => {
  it('spaces nodes evenly over the domain', () => {
    expect(Array.from(computeXPositions(100_000, 5))).toEqual([0, 25_000, 50_000, 75_000, 100_000]);
  });

  it('pads the elevation range below the bed and above the surface', () => {
    const state = makeState();
    expect(computeElevationRange(state.b, state.s)).toEqual({ zMin: -1400, zMax: 1700 });
    expect(computeElevationRange(undefined, undefined)).toEqual({ zMin: -1500, zMax: 4000 });
  });

  it('flags ice seaward of the grounding line as floating', () => {
    const state = makeState();
    const x = computeXPositions(100_000, 5);
    expect(Array.from(computeFloatingMask(state.H, x, 40_000))).toEqual([0, 0, 1, 1, 0]);
  });
});

describe('getFrameGeometry', () => {
  it('is memoized on the state object', () => {
    const state = makeState();
    const a = getFrameGeometry(state, 100);
    expect(getFrameGeometry(state, 100)).toBe(a);
    expect(a.glPositionM).toBe(40_000);
    expect(a.domainLengthM).toBe(100_000);
  });

  it('recomputes for a new state but reuses the x positions', () => {
    const a = getFrameGeometry(makeState(), 100);
    const b = getFrameGeometry(makeState({ gl_position: 70 }), 100);
    expect(b).not.toBe(a);
    expect(b.xPositions).toBe(a.xPositions);
    expect(Array.from(b.isFloating)).toEqual([0, 0, 0, 1, 0]);
  });

  it('recomputes when the domain length changes', () => {
    const state = makeState();
    const a = getFrameGeometry(state, 100);
    const b = getFrameGeometry(state, 200);
    expect(b).not.toBe(a);
    expect(b.xPositions[4]).toBe(200_000);
  });
});
