/**
 * Physical constants for the ice sheet model.
 */

// ─── Fundamental Constants ──────────────────────────────────────

/** Ice density (kg/m³) */
export const RHO_ICE = 917;

/** Seawater density (kg/m³) */
export const RHO_WATER = 1028;

/** Freshwater density (kg/m³) */
export const RHO_FRESH = 1000;

/** Gravitational acceleration (m/s²) */
export const G = 9.81;

/** Glen's flow law exponent */
export const GLEN_N = 3;

/** Seconds per year */
export const SEC_PER_YEAR = 365.25 * 24 * 3600;

// ─── Flow Law ───────────────────────────────────────────────────

/**
 * Reference flow rate factor A at -10°C (Pa⁻³ s⁻¹)
 * Converted to Pa⁻³ yr⁻¹ for internal use.
 */
export const A_REFERENCE = 3.985e-13 * SEC_PER_YEAR; // Pa⁻³ yr⁻¹ (cold ice, T < -10°C)

/** Activation energy for cold ice T < -10°C (J/mol) */
export const Q_COLD = 60e3;

/** Activation energy for warm ice T >= -10°C (J/mol) */
export const Q_WARM = 139e3;

/** Pre-exponential for cold ice (Pa⁻³ s⁻¹) */
export const A0_COLD = 3.985e-13;

/** Pre-exponential for warm ice (Pa⁻³ s⁻¹) */
export const A0_WARM = 1.916e3;

/** Gas constant (J/(mol·K)) */
export const R_GAS = 8.314;

/** Reference temperature for Arrhenius (K) = -10°C */
export const T_REF_ARRHENIUS = 263.15;

/** Regularization strain rate (yr⁻¹), prevent viscosity divergence */
export const STRAIN_RATE_MIN = 1e-10 * SEC_PER_YEAR;

// ─── Sliding Law ────────────────────────────────────────────────

/** Basal sliding coefficient C (Pa m⁻¹/³ s¹/³) converted to yearly */
export const C_SLIDING = 7.624e6;

/** Sliding exponent m */
export const SLIDING_M = 1 / 3;

/** Effective pressure exponent q */
export const SLIDING_Q = 1;

// ─── Basal Friction Inversion ──────────────────────────────────

/** Minimum allowed inverted basal friction coefficient */
export const C_BASAL_MIN = 1e3;

/** Maximum allowed inverted basal friction coefficient */
export const C_BASAL_MAX = 1e9;

/** Inversion damping exponent (0 < α < 1; smaller = more damping) */
export const INVERSION_ALPHA = 0.5;

/** Maximum inversion outer iterations */
export const INVERSION_MAX_ITER = 15;

/** Inversion convergence tolerance (normalized RMS misfit) */
export const INVERSION_TOL = 0.05;

// ─── Surface Mass Balance ───────────────────────────────────────

/** Maximum accumulation rate (m/yr ice eq.) */
export const SMB_A_MAX = 0.5;

/** Reference accumulation rate (m/yr ice eq.) */
export const SMB_A0 = 0.3;

/** Temperature sensitivity for accumulation (m/yr/°C) */
export const SMB_LAMBDA = 0.05;

/** Atmospheric lapse rate (°C/km) */
export const LAPSE_RATE = 6.5;

/**
 * Positive degree-day melt factor (m/yr/°C).
 *
 * Literature range for the integrated PDD factor: ice ~8 mm/d/K, snow
 * ~3 mm/d/K (Braithwaite 1995, Hock 2003). Multiplied by a typical
 * Antarctic melt-season length (~20–30 days at the margins) this works
 * out to roughly 0.1–0.25 m/yr/K for bare ice and 0.05 m/yr/K for snow.
 * We use 0.15 as a margin-weighted central estimate. The earlier value
 * of 0.005 was tuned for present-day interior equilibrium (where melt
 * is essentially zero) and underestimates the response under high-end
 * warming scenarios where ablation zones expand onto the coast.
 */
export const PDD_FACTOR = 0.15;

/** Base atmospheric temperature (°C) */
export const T_ATM_BASE = -20;

/**
 * Clausius–Clapeyron scaling for accumulation response to warming (1/K).
 * A warmer atmosphere holds exponentially more water vapor; for the polar
 * continents observational (Palerme et al. 2017) and reanalysis studies
 * converge on ~5–7 %/K — we use 7 %/K as the central estimate.
 */
export const CC_SCALING = 0.07;

/**
 * Polar amplification factor: ratio of Antarctic surface warming to the
 * global-mean anomaly (CMIP6 land-surface ensemble median ≈ 1.5–2.0; we
 * use 1.8). Used to convert the user-facing global ΔT into the anomaly
 * actually seen at the ice surface and in the CC accumulation response.
 */
export const POLAR_AMPLIFICATION = 1.8;

// ─── Ocean Melt ─────────────────────────────────────────────────

/** Thermal exchange coefficient for ocean melt (m/yr/°C²) */
export const GAMMA_T = 0.5;

/** Pressure-dependent freezing point at surface (°C) */
export const T_FREEZING_SURFACE = -1.9;

/** Freezing point depression with depth (°C/m) */
export const T_FREEZING_DEPTH = -7.53e-4;

/** Base ocean temperature (°C) */
export const T_OCEAN_BASE = -1.5;

// ─── PICO (Potsdam Ice-shelf Cavity mOdel) ─────────────────────

/**
 * Specific heat capacity of seawater (J kg⁻¹ K⁻¹). Used by PICO heat
 * balance when converting melt-extracted enthalpy back into temperature
 * drop of the overturning water mass.
 */
export const C_P_OCEAN = 3974;

/**
 * Specific overturning velocity coefficient for the PICO cavity
 * circulation (m yr⁻¹ K⁻¹).
 *
 * Parameterizes the buoyant-plume velocity as v = C · TF, so that the
 * per-unit-width overturning flux is q = v · L_box = C · TF · L_box.
 * This formulation is scale-invariant — heat extraction by melt also
 * scales with L_box, so the resulting Box-1 temperature drop ΔT_1
 * depends only on melt rate and ambient TF, not on cavity length.
 *
 * C = 100 m yr⁻¹ K⁻¹ produces a ~0.5–1 K cooling of the outflow from
 * Box 1 under typical Antarctic warm-regime forcing (TF ≈ 2–3 K),
 * giving a realistic 2–3× contrast between grounding-line and
 * calving-front melt rates.
 */
export const PICO_OVERTURNING_C = 100;

/**
 * Lower bound on the overturning thermal-forcing driver (K). Prevents
 * the flux q from collapsing to zero when ambient water is at/below the
 * in-situ freezing point at the grounding line; otherwise the box-1
 * heat-balance ΔT diverges.
 */
export const PICO_MIN_DRIVER = 0.1;

/**
 * Fraction of the floating flowline assigned to Box 1 (grounding-line
 * side). Box 2 covers the remainder toward the calving front. 0.5 is
 * the standard PICO equal-split choice when shelf geometry is unknown.
 */
export const PICO_BOX_SPLIT = 0.5;

// ─── Subglacial Hydrology ───────────────────────────────────────

/** Water pressure coupling coefficient */
export const K_WATER = 0.9;

/** Default drainage timescale (yr) */
export const TAU_DRAIN_DEFAULT = 1.0;

/** Effective diffusivity for subglacial water saturation (m²/yr) */
export const K_HYDRAULIC = 1e4;

/** Characteristic basal water-layer thickness used to normalize W (m) */
export const WATER_LAYER_THICKNESS_SCALE = 0.1;

/**
 * Fraction of surface meltwater that reaches the bed via crevasses / moulins
 * when hydrology is active (Zwally et al. 2002 seasonal speed-up feedback).
 * 0.3–0.5 is the typical range cited for Greenland; we adopt 0.4. Only takes
 * effect where SMB < 0 (surface ablation zone).
 */
export const SURFACE_TO_BED_FRACTION = 0.4;

/** Latent heat of fusion (J/kg) */
export const L_FUSION = 3.34e5;

/** Geothermal heat flux (W/m²) */
export const Q_GEOTHERMAL = 0.05;

// ─── Temperature ────────────────────────────────────────────────

/** Thermal diffusivity of ice (m²/s) */
export const KAPPA_ICE = 1.09e-6;

/** Thermal diffusivity of ice (m²/yr) */
export const KAPPA_ICE_YR = KAPPA_ICE * SEC_PER_YEAR;

/** Pressure melting point coefficient (°C/m of ice) */
export const PRESSURE_MELTING = -8.7e-4;

// ─── Numerical Parameters ───────────────────────────────────────

/** Default horizontal grid spacing (km) */
export const DEFAULT_DX = 2;

/** Default number of vertical sigma layers */
export const DEFAULT_NZ = 20;

/** Default domain length (km) */
export const DEFAULT_DOMAIN_LENGTH = 800;

/** Default time step (years) — small for CFL stability at 2 km resolution */
export const DEFAULT_DT = 0.1;

/** Picard iteration tolerance */
export const PICARD_TOL = 1e-4;

/** Maximum Picard iterations */
export const PICARD_MAX_ITER = 8;

/** Picard relaxation factor */
export const PICARD_OMEGA = 0.7;

/** Minimum ice thickness to keep (m) */
export const H_MIN = 10.0;

/** Maximum ice thickness (m) — stability guard */
export const H_MAX = 6000;

/** Maximum velocity (m/yr) — CFL stability cap */
export const U_MAX = 10000;

// ─── Unit Conversions ───────────────────────────────────────────

/** Convert ice volume (m³) to sea level equivalent (m) */
export const VOLUME_TO_SLE = RHO_ICE / (RHO_WATER * 3.625e14); // Ocean area ~362.5 million km²

// ─── Cliff Calving (MICI) ──────────────────────────────────────

/** MICI base calving rate coefficient (m/yr) — Schlemm & Levermann 2019 */
export const MICI_C0 = 91.25;

/**
 * Maximum MICI calving rate cap (m/yr).
 *
 * Chosen to match the upper bound of observed marine-terminating glacier
 * retreat rates (Jakobshavn peak ~ 1–1.5 km/yr; Thwaites ~ 0.5–1 km/yr).
 * The DeConto & Pollard (2016) original cap was 3000 m/yr, but Bassis
 * et al. (2021) argue viscoelastic stability limits cliff-failure
 * velocities well below that. We therefore adopt 1500 m/yr as a
 * conservative upper bound consistent with the reviewed literature.
 */
export const MICI_C_MAX = 1500;

/**
 * Additional freeboard margin (m) applied on top of the Schlemm–Levermann
 * geometric threshold F_t = 75 − 49·(ρ_i/ρ_w). Raising the effective
 * threshold to ≈ 90 m of freeboard reflects Bassis & Walker (2012) and
 * Bassis et al. (2021), who argue that short-timescale viscoelastic
 * relaxation lets ice cliffs stand much taller than the instantaneous
 * brittle estimate before catastrophic failure. Setting this to 0
 * recovers the DP16-style low threshold.
 */
export const MICI_F_MARGIN = 60;
