/**
 * Constants for Antarctic terrain rendering.
 * Extracted from 3D-ICE explorer to match visual output exactly.
 */

// ── Scene scale ──────────────────────────────────────────────────────
/** Target extent of the scene in Three.js world units. */
export const TARGET_WORLD_EXTENT_UNITS = 128;

/**
 * Ratio between horizontal and vertical meters-per-unit.
 * This produces the default vertical exaggeration factor when scale.y = 1.
 */
export const BASE_HORIZONTAL_VERTICAL_SCALE_RATIO = 52_000 / 3_800;

/** Meters to lift flowlines above the ice surface (avoids z-fighting). */
export const FLOWLINE_SURFACE_OFFSET_M = 26;

/** Default vertical exaggeration applied to the scene group. */
export const DEFAULT_EXAGGERATION = 4.8;

// ── Bed elevation ────────────────────────────────────────────────────
export const BED_ELEVATION_MIN = -7_000; // m
export const BED_ELEVATION_MAX = 3_500;  // m

// ── Velocity visualization ──────────────────────────────────────────
export const VELOCITY_MIN = 0;       // m/yr
export const VELOCITY_MAX = 3_000;   // m/yr
export const VELOCITY_KNEE = 20;     // m/yr  (log-scale knee)

/** Blue → Cyan → Yellow → Red color stops for velocity. */
export const VELOCITY_COLOR_STOPS: readonly [number, readonly [number, number, number]][] = [
  [0.0,  [0.06, 0.20, 0.50]],
  [0.35, [0.08, 0.62, 0.86]],
  [0.65, [0.95, 0.90, 0.27]],
  [1.0,  [0.90, 0.20, 0.12]],
] as const;

// ── Ice coloring ────────────────────────────────────────────────────
/** Maximum thickness used for color normalization. */
export const ICE_THICKNESS_REFERENCE = 4_200; // m

/** BedMachine mask values. */
export const MASK_OCEAN = 0;
export const MASK_GROUNDED = 2;
export const MASK_FLOATING = 3;
export const MASK_LAKE = 4;

// ── GMT Relief fallback colors ──────────────────────────────────────
export const GMT_RELIEF_OCEAN_ZERO: readonly [number, number, number] = [0.975613, 0.999387, 0.994608];
export const GMT_RELIEF_LAND_ZERO: readonly [number, number, number]  = [0.284908, 0.466429, 0.196078];

// ── Scene visual ────────────────────────────────────────────────────
export const SCENE_BACKGROUND = 0x0a2b43;
export const FOG_NEAR = 80;
export const FOG_FAR = 240;

// ── WGS-84 ellipsoid (for EPSG:3031 projection) ────────────────────
export const WGS84_A = 6_378_137.0;            // semi-major axis (m)
export const WGS84_E = 0.081819190842622;       // eccentricity
export const EPSG3031_STANDARD_PARALLEL = -71;  // degrees
