/**
 * Ocean melt parameterization — PICO 2-box cavity model.
 *
 * Reese, Albrecht & Levermann (2018), "Antarctic sub-shelf melt rates via
 * PICO", The Cryosphere 12:1969–1985.
 *
 * Rationale: the earlier local quadratic law m(x) = γ_T · TF(x)² applied
 * the same ambient temperature at every floating grid point, which
 * over-predicts melt near the calving front because it ignores the
 * buoyancy-driven upwelling that carries water from the open ocean up
 * along the sloping ice base. Real sub-shelf melt peaks at the grounding
 * line (raw thermal forcing) and decays toward the front (water cooled
 * and freshened by prior melting).
 *
 * Two-box simplification used here:
 *
 *   ambient ocean (T_0, S_0)
 *         │                  ┌─ Box 2 (calving-front half) ─┐
 *         │   ┌─ Box 1 (GL-side half) ─┐                      │
 *         └──▶│  T_0  ──melt──▶  T_1   │──overturning q──▶ T_1 ──melt──▶
 *             └────────────────────────┘                      └───────
 *
 * Per-point melt in box k uses the BOX-SPECIFIC inflow temperature, not
 * the raw ambient. Heat extracted by box 1 cools the water entering
 * box 2, suppressing downstream melt. The overturning flux q is set by
 * the ambient thermal forcing at the grounding line (proxy for
 * buoyancy contrast).
 *
 * Heat balance across box k (per unit flowline width):
 *
 *   q · ρ_sw · c_p · (T_in_k − T_out_k) = ∫_k m · L_fusion · ρ_ice · dx
 *
 *   ⇒  ΔT_k = (∫_k m dx · L · ρ_ice) / (q · c_p · ρ_sw)
 *
 * Freezing point is pressure-dependent, so deeper grounding lines
 * automatically see larger TF at the same ambient temperature.
 */

import {
  GAMMA_T, T_FREEZING_SURFACE, T_FREEZING_DEPTH,
  T_OCEAN_BASE, RHO_ICE, RHO_WATER,
  C_P_OCEAN, PICO_OVERTURNING_C, PICO_MIN_DRIVER, PICO_BOX_SPLIT,
  L_FUSION,
} from './constants';
import type { UserParams } from './types';

/**
 * Pressure-dependent (in-situ) freezing point of seawater.
 *
 * @param depth Depth below sea surface (m, positive downward)
 * @returns Freezing point (°C)
 */
function freezingPoint(depth: number): number {
  return T_FREEZING_SURFACE + T_FREEZING_DEPTH * depth;
}

/**
 * Draft of floating ice (how deep the base sits below the sea surface).
 */
function draftFromThickness(H: number): number {
  return H * RHO_ICE / RHO_WATER;
}

/**
 * Effective ocean temperature at a floating point after the geoengineering
 * curtain (if any). Preserves the original single-point semantics.
 */
function applyCurtain(
  T_ocean: number,
  baseline: number,
  params: UserParams,
  x: Float64Array | undefined,
  i: number,
): number {
  if (
    params.curtain_position == null ||
    params.curtain_efficiency == null ||
    x == null
  ) {
    return T_ocean;
  }
  const curtainPosM = params.curtain_position * 1000;
  if (x[i] <= curtainPosM) return T_ocean;
  // Seaward of the curtain: attenuate the ΔT anomaly only — the baseline
  // (natural) ocean temperature is unchanged.
  const dT = (T_ocean - baseline) * (1 - params.curtain_efficiency);
  return baseline + dT;
}

/**
 * Quadratic melt law at a single floating point given the temperature of
 * the water column actually bathing that point.
 */
function quadraticMelt(H: number, T_in: number): number {
  if (H < 1) return 0;
  const draft = draftFromThickness(H);
  const Tf = freezingPoint(draft);
  const TF = T_in - Tf;
  if (TF <= 0) return 0;
  return GAMMA_T * TF * TF;
}

/**
 * Exported single-point helper — retained for completeness and tests.
 * Uses the ambient ocean temperature (no box processing).
 */
export function computeOceanMeltPoint(
  iceThickness: number,
  _bedrock: number,
  params: UserParams,
  T_ocean_base: number = T_OCEAN_BASE,
  curtainFactor: number = 1.0,
): number {
  const T_ocean = T_ocean_base + params.T_ocean_delta * curtainFactor;
  return quadraticMelt(iceThickness, T_ocean);
}

/**
 * PICO 2-box ocean melt across the whole profile.
 *
 * Falls back to the local quadratic law if there is one or zero floating
 * cells (the box split is ill-defined).
 */
export function computeOceanMelt(
  H: Float64Array,
  _b: Float64Array,
  is_floating: Uint8Array,
  params: UserParams,
  T_ocean_base: number = T_OCEAN_BASE,
  x?: Float64Array,
): Float64Array {
  const nx = H.length;
  const melt = new Float64Array(nx);

  // Gather floating indices in grid order.
  const floating: number[] = [];
  for (let i = 0; i < nx; i++) {
    if (is_floating[i] && H[i] >= 1) floating.push(i);
  }
  if (floating.length === 0) return melt;

  const T_amb_raw = T_ocean_base + params.T_ocean_delta;

  // Degenerate shelf (single cell): skip box processing.
  if (floating.length === 1) {
    const i = floating[0];
    const T_here = applyCurtain(T_amb_raw, T_ocean_base, params, x, i);
    melt[i] = quadraticMelt(H[i], T_here);
    return melt;
  }

  // Split into Box 1 (GL-side) and Box 2 (front-side). Always keep at
  // least one cell in each box.
  const nFloat = floating.length;
  const split = Math.max(1, Math.min(nFloat - 1, Math.floor(nFloat * PICO_BOX_SPLIT)));
  const box1 = floating.slice(0, split);
  const box2 = floating.slice(split);

  // Pass 1 — Box 1 melt using ambient water.
  let heatBox1 = 0; // ∫ m · L · ρ_ice · dx, per m flowline width (J/(m·yr))
  let lenBox1 = 0; // cumulative Box 1 length (m)
  const firstGLIdx = box1[0];
  for (const i of box1) {
    const T_here = applyCurtain(T_amb_raw, T_ocean_base, params, x, i);
    const m = quadraticMelt(H[i], T_here);
    melt[i] = m;
    const dx = localDx(x, i, nx);
    heatBox1 += m * dx * L_FUSION * RHO_ICE;
    lenBox1 += dx;
  }

  // Overturning flux: q = v · L_box1, with v = C · TF_ambient (buoyant-plume
  // velocity proportional to thermal forcing). Length scaling keeps ΔT_1
  // invariant across shelves of different extent.
  const glDraft = draftFromThickness(H[firstGLIdx]);
  const ambTF = Math.max(
    PICO_MIN_DRIVER,
    applyCurtain(T_amb_raw, T_ocean_base, params, x, firstGLIdx) - freezingPoint(glDraft),
  );
  const q_over = PICO_OVERTURNING_C * ambTF * lenBox1; // m²/yr per m flowline width

  // Temperature drop of the outflow from Box 1.
  const heatCapacityFlux = q_over * C_P_OCEAN * RHO_WATER; // J/(K·m·yr)
  const dT_box1 = heatCapacityFlux > 0 ? heatBox1 / heatCapacityFlux : 0;

  // Pass 2 — Box 2 melt using water already cooled by Box 1.
  for (const i of box2) {
    const T_here_ambient = applyCurtain(T_amb_raw, T_ocean_base, params, x, i);
    const T_in2 = T_here_ambient - dT_box1;
    melt[i] = quadraticMelt(H[i], T_in2);
  }

  return melt;
}

/**
 * Local grid spacing at index i. Uses the provided `x` array when
 * available, otherwise falls back to the default 2 km spacing.
 */
function localDx(x: Float64Array | undefined, i: number, nx: number): number {
  if (x == null) return 2000;
  if (i === 0) return Math.max(1, x[1] - x[0]);
  if (i === nx - 1) return Math.max(1, x[nx - 1] - x[nx - 2]);
  return Math.max(1, 0.5 * (x[i + 1] - x[i - 1]));
}
