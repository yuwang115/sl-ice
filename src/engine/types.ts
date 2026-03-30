/**
 * Type definitions for the ice sheet physics engine.
 */

// ─── Communication Protocol (Main Thread ↔ Worker) ─────────────

export interface PhysicsCommand {
  type: 'init' | 'step' | 'update_params' | 'reset';
  payload: {
    scenario?: ScenarioConfig;
    params?: UserParams;
    dt?: number;
    nSteps?: number;
  };
}

export interface UserParams {
  T_atm_delta: number;       // Atmospheric temperature offset (°C)
  T_ocean_delta: number;     // Ocean temperature offset (°C)
  precip_scale: number;      // Precipitation scaling factor
  drain_efficiency: number;  // Drainage efficiency (yr)
  enable_hydrology: boolean;
  curtain_position?: number;   // Geoengineering: seafloor barrier position (km)
  curtain_efficiency?: number; // Geoengineering: barrier efficiency (0-1)
}

export interface PhysicsState {
  type: 'state_update';
  payload: PhysicsStatePayload;
}

export interface PhysicsStatePayload {
  year: number;
  H: Float64Array;           // Ice thickness profile (m)
  u_surface: Float64Array;   // Surface velocity profile (m/yr)
  u_base: Float64Array;      // Basal velocity profile (m/yr)
  s: Float64Array;           // Surface elevation profile (m)
  b: Float64Array;           // Bedrock elevation profile (m)
  ice_base: Float64Array;    // Ice base elevation (bedrock if grounded, -draft if floating)
  gl_position: number;       // Grounding line position (km)
  gl_velocity: number;       // Velocity at grounding line (m/yr)
  volume: number;            // Ice volume (km³)
  sea_level: number;         // Sea level equivalent change (m)
  shelf_exists: boolean;     // Whether an ice shelf exists
  water_pressure: Float64Array; // Subglacial water pressure profile
  is_misi_active: boolean;   // Whether MISI is currently active
  events: GameEvent[];       // Triggered game events
  smb: Float64Array;         // Surface mass balance profile (m/yr)
  u_depth_avg: Float64Array; // Depth-averaged velocity (m/yr)
}

export interface GameEvent {
  type:
    | 'gl_retreat_accelerating'
    | 'shelf_collapsed'
    | 'misi_triggered'
    | 'hysteresis_locked'
    | 'city_flooded'
    | 'ice_recovered';
  message_en: string;
  message_zh: string;
  severity: 'info' | 'warning' | 'critical';
}

// ─── Scenario Configuration ─────────────────────────────────────

export interface FlowlineGeometryPoint {
  distance_km: number;
  x_m: number;
  y_m: number;
  lon: number;
  lat: number;
  bed_m: number;
  surface_m: number;
  thickness_m: number;
  mask: number;
  speed_m_per_yr: number;
}

export interface FlowlineGeometry {
  spacing_km: number;
  points: FlowlineGeometryPoint[];
}

export interface ScenarioRegionInfo {
  name_en: string;
  name_zh: string;
  location: string;
  sea_level_m: number;
  current_retreat_m_yr: number;
  key_facts_en: string[];
  key_facts_zh: string[];
}

export interface ScenarioConfig {
  name: string;
  name_zh?: string;
  description_en: string;
  description_zh: string;
  domain_length: number;     // km
  nx?: number;               // Number of horizontal grid points (computed from domain_length/dx if omitted)
  nz?: number;               // Number of vertical (sigma) layers (defaults to DEFAULT_NZ if omitted)
  bedrock: number[];         // Bedrock elevation at each x node (m)
  initial_H?: number[];      // Optional initial ice thickness (m)
  T_atm_base: number;        // Base atmospheric temperature (°C)
  T_ocean_base: number;      // Base ocean temperature (°C)
  P_snow_base: number;       // Base snowfall rate (m/yr ice eq.)
  enable_hydrology: boolean;
  sea_level_potential?: number;
  geometry?: FlowlineGeometry;
  region_info?: ScenarioRegionInfo;
}

// ─── Internal Model State ───────────────────────────────────────

export interface ModelGrid {
  nx: number;       // Number of horizontal nodes
  nz: number;       // Number of vertical sigma layers
  dx: number;       // Horizontal spacing (m)
  dsigma: number;   // Vertical sigma spacing
  x: Float64Array;  // Horizontal positions (m)
  sigma: Float64Array; // Sigma levels [0, 1]
}

export interface ModelState {
  grid: ModelGrid;
  year: number;

  // 1D fields (nx)
  H: Float64Array;           // Ice thickness (m)
  b: Float64Array;           // Bedrock elevation (m)
  s: Float64Array;           // Surface elevation (m)
  ice_base: Float64Array;    // Ice base elevation (m) — bedrock if grounded, -draft if floating
  u_depth_avg: Float64Array; // Depth-averaged velocity (m/yr)
  smb: Float64Array;         // Surface mass balance (m/yr)
  basal_melt: Float64Array;  // Basal melt rate (m/yr)
  N_eff: Float64Array;       // Effective pressure (Pa)
  W: Float64Array;           // Normalized subglacial water (0-1)

  // 2D velocity field (nx × nz), row-major: u[i * nz + j]
  u: Float64Array;

  // Grounding line
  gl_index: number;          // Index of last grounded node
  gl_position: number;       // Interpolated GL position (m)
  is_floating: Uint8Array;   // 1 if floating, 0 if grounded

  // MISI tracking
  prev_gl_position: number;
  gl_retreat_rate: number;   // m/yr
  is_misi_active: boolean;
  misi_triggered_year: number;
  hysteresis_locked: boolean;

  // Ice volume tracking
  initial_volume: number;    // km³
  volume: number;            // km³
  sea_level: number;         // m SLE

  // Params
  params: UserParams;
}

// ─── Challenge Types ────────────────────────────────────────────

export type ChallengeStatus = 'locked' | 'available' | 'in_progress' | 'won' | 'lost';

export interface ChallengeDefinition {
  id: number;
  name_en: string;
  name_zh: string;
  subtitle_en: string;
  subtitle_zh: string;
  description_en: string;
  description_zh: string;
  difficulty: number;         // 1-5 stars
  scenario: string;           // Scenario config key
  concepts: string[];
  initial_params: Partial<UserParams>;
  enable_hydrology: boolean;
  duration_years: number;
  check_win: (state: ModelState, elapsed_years: number) => boolean;
  check_lose: (state: ModelState, elapsed_years: number) => boolean;
  unlock_condition?: (completed: number[]) => boolean;
}

// ─── Game Mode ──────────────────────────────────────────────────

export type GameMode = 'menu' | 'sandbox' | 'challenge' | 'real_world' | 'explorer';

export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'ultra';
