import type { GameEvent, PhysicsStatePayload, ScenarioConfig } from '../../src/engine/types';

export function physicsState(overrides: Partial<PhysicsStatePayload> = {}): PhysicsStatePayload {
  return {
    year: 0,
    H: new Float64Array([1000, 800]),
    u_surface: new Float64Array([50, 80]),
    u_base: new Float64Array([10, 20]),
    s: new Float64Array([1200, 900]),
    b: new Float64Array([-300, -400]),
    ice_base: new Float64Array([-300, -400]),
    gl_position: 500,
    gl_velocity: 10,
    gl_flux_km3_yr: 0.01,
    volume: 1000,
    mass_change_gt: 0,
    sea_level: 0,
    shelf_exists: true,
    water_pressure: new Float64Array([0, 0]),
    is_misi_active: false,
    cliff_height: 0,
    mici_calving_rate: 0,
    is_mici_active: false,
    events: [],
    smb: new Float64Array([0.1, 0.1]),
    u_depth_avg: new Float64Array([30, 50]),
    nx: 2,
    nz: 1,
    dsigma: 1,
    ...overrides,
  };
}

export function gameEvent(type: GameEvent['type'], suffix = ''): GameEvent {
  return {
    type,
    message_en: `${type} en${suffix}`,
    message_zh: `${type} zh${suffix}`,
    severity: 'critical',
  };
}

export function scenarioConfig(overrides: Partial<ScenarioConfig> = {}): ScenarioConfig {
  return {
    name: 'Test scenario',
    description_en: '',
    description_zh: '',
    domain_length: 100,
    bedrock: [-300, -400],
    T_atm_base: -20,
    T_ocean_base: -1.5,
    P_snow_base: 0.3,
    enable_hydrology: false,
    ...overrides,
  };
}
