import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dashboard from '../../src/components/layout/Dashboard';
import { usePhysicsStore, type PhysicsHistoryPoint } from '../../src/store/physics-store';
import { useUIStore } from '../../src/store/ui-store';
import type { PhysicsStatePayload } from '../../src/engine/types';

function createPhysicsState(): PhysicsStatePayload {
  return {
    year: 112,
    H: new Float64Array([1200, 900]),
    u_surface: new Float64Array([80, 120]),
    u_base: new Float64Array([25, 40]),
    s: new Float64Array([1400, 950]),
    b: new Float64Array([-300, -450]),
    ice_base: new Float64Array([-300, -500]),
    gl_position: 821,
    gl_velocity: 13,
    gl_flux_km3_yr: 0.021,
    volume: 1772.3,
    mass_change_gt: 35.3,
    sea_level: 32.66,
    shelf_exists: true,
    water_pressure: new Float64Array([0.2, 0.4]),
    is_misi_active: false,
    cliff_height: 0,
    mici_calving_rate: 0,
    is_mici_active: false,
    events: [],
    smb: new Float64Array([0.1, 0.08]),
    u_depth_avg: new Float64Array([60, 90]),
  };
}

function createHistory(): PhysicsHistoryPoint[] {
  return [
    { year: 0, glFluxKm3Yr: 0.012, massChangeGt: -2.864 },
    { year: 112, glFluxKm3Yr: 0.021, massChangeGt: 35.3 },
  ];
}

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();

    useUIStore.setState({
      language: 'en',
      canvasWidth: 1200,
      canvasHeight: 800,
    });

    usePhysicsStore.setState({
      state: createPhysicsState(),
      history: createHistory(),
      events: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders as a floating trend window with both charts visible together', () => {
    render(<Dashboard />);

    const dialog = screen.getByRole('dialog', { name: 'Trend charts' });
    const scoped = within(dialog);

    expect(scoped.getByRole('img', { name: 'Grounding Line Ice Flux' })).toBeTruthy();
    expect(scoped.getByRole('img', { name: 'Total Ice Mass Change' })).toBeTruthy();
    expect(scoped.getByRole('button', { name: 'Default position' })).toBeTruthy();
    expect(scoped.getAllByLabelText(/resize trend window/i).length).toBeGreaterThan(0);
  });
});
