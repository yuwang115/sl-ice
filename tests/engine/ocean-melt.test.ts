import { describe, expect, it } from 'vitest';

import { computeOceanMelt } from '../../src/engine/ocean-melt';
import { defaultParams } from '../../src/engine/physics';
import type { UserParams } from '../../src/engine/types';

const T_OCEAN_BASE = -1.5;

/** 0–100 km profile: grounded for x < 30 km, a uniform 400 m shelf beyond. */
function shelfProfile() {
  const nx = 11;
  const x = Float64Array.from({ length: nx }, (_, i) => i * 10_000);
  const H = new Float64Array(nx).fill(400);
  const b = new Float64Array(nx).fill(-1000);
  const floating = new Uint8Array(nx).fill(1);
  floating.fill(0, 0, 3);
  return { x, H, b, floating };
}

function melt(params: UserParams): Float64Array {
  const { x, H, b, floating } = shelfProfile();
  return computeOceanMelt(H, b, floating, params, T_OCEAN_BASE, x);
}

describe('seafloor curtain', () => {
  const warm: UserParams = { ...defaultParams(), T_ocean_delta: 2 };

  it('shields the whole cavity when it stands at the shelf front', () => {
    const open = melt(warm);
    const shielded = melt({ ...warm, curtain_position: 100, curtain_efficiency: 1 });
    for (let i = 3; i < 10; i++) {
      expect(shielded[i]).toBeLessThan(open[i]);
    }
  });

  it('shields only the ice landward of it', () => {
    const open = melt(warm);
    // Floating cells 3..10; PICO box 1 = cells 3..6. A curtain at 50 km
    // shields cells 3 and 4; cells 5 and 6 still see the open ocean.
    const partial = melt({ ...warm, curtain_position: 50, curtain_efficiency: 1 });
    expect(partial[3]).toBeLessThan(open[3]);
    expect(partial[4]).toBeLessThan(open[4]);
    expect(partial[5]).toBeCloseTo(open[5], 12);
    expect(partial[6]).toBeCloseTo(open[6], 12);
  });

  it('does nothing when placed under grounded ice', () => {
    const open = melt(warm);
    const inland = melt({ ...warm, curtain_position: 10, curtain_efficiency: 1 });
    expect(Array.from(inland)).toEqual(Array.from(open));
  });
});
