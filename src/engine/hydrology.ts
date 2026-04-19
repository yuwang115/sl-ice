/**
 * Simplified subglacial hydrology module.
 *
 * W is a normalized basal water saturation, interpreted as a basal
 * water-layer thickness divided by WATER_LAYER_THICKNESS_SCALE.
 *
 * Effective pressure:
 *   N(x) = ρ_i g H(x) * (1 - k_w * W(x))
 *
 * Saturation evolution:
 *   ∂W/∂t = m_w / W* - W * k_drain + D_w ∂²W/∂x²
 *
 * where:
 *   W = normalized subglacial water amount (0 = dry, 1 = saturated)
 *   m_w = total basal water source (grounded basal melt + surface melt
 *         routed to the bed via crevasses / moulins; m/yr water equiv.)
 *   W* = characteristic water-layer thickness
 *   k_drain = drainage rate [1/yr] = params.drain_efficiency (user-controlled;
 *             higher value → faster drainage → lower W → higher N → slower sliding)
 *   D_w = effective hydrologic diffusivity
 *
 * NOTE on semantics: in earlier revisions `drain_efficiency` was used directly
 * as the drainage *timescale* (τ), which inverted the intuitive meaning — the
 * UI tooltip promised "lower values → more water pressure", but the math did
 * the opposite. We now treat `drain_efficiency` as a true rate coefficient:
 * dW/dt = source − drain_efficiency · W. The steady-state W is
 * W_eq ≈ source / drain_efficiency, so at the default value 1.0 the
 * equilibrium is unchanged vs. the old τ = 1 yr behavior.
 */

import {
  RHO_ICE, RHO_FRESH, G,
  K_WATER, K_HYDRAULIC,
  WATER_LAYER_THICKNESS_SCALE,
  L_FUSION, Q_GEOTHERMAL, C_SLIDING, SLIDING_M,
  SURFACE_TO_BED_FRACTION,
} from './constants';
import { clamp } from './matrix/utils';
import type { ModelGrid, UserParams } from './types';

/**
 * Compute basal melt production from geothermal and frictional heating.
 *
 * Q_melt = Q_geo + τ_b * u_b
 *
 * @param u_base Basal velocity (m/yr)
 * @param N_eff Effective pressure (Pa)
 * @returns Basal melt production (m/yr water equivalent)
 */
function basalMeltProductionWaterEq(
  u_base: number,
  N_eff: number,
  C_local: number = C_SLIDING,
): number {
  // Frictional heating: τ_b * u_b
  const u_b = Math.abs(u_base);
  const beta = C_local * Math.pow(u_b + 1e-6, SLIDING_M - 1) * Math.max(N_eff, 0);
  // The sliding-law coefficient is tuned for the momentum solver rather than
  // direct stress diagnostics, so cap basal shear stress to a realistic range
  // before converting it to frictional heat.
  const tau_b = Math.min(beta * u_b, 2e5); // Pa
  const frictionalHeat = tau_b * u_b; // J/(m²·yr) = Pa · m/yr

  // Convert geothermal heat from W/m² to J/(m²·yr)
  const SEC_PER_YEAR = 365.25 * 24 * 3600;
  const Q_geo_yearly = Q_GEOTHERMAL * SEC_PER_YEAR; // J/(m²·yr)

  // Total heat in J/(m²·yr)
  const totalHeat = Q_geo_yearly + frictionalHeat;

  // Melt rate: Q / (ρ_w * L_f) in m/yr
  return totalHeat / (RHO_FRESH * L_FUSION);
}

/**
 * Compute grounded basal melt from geothermal + frictional heating.
 *
 * Returns both water-equivalent melt for hydrology and ice-equivalent melt
 * for the thickness equation so mass is conserved.
 */
export function computeGroundedBasalMelt(
  u_base: Float64Array,
  H: Float64Array,
  N_eff: Float64Array,
  is_floating: Uint8Array,
  C_basal?: Float64Array,
): { waterEq: Float64Array; iceEq: Float64Array } {
  const nx = H.length;
  const waterEq = new Float64Array(nx);
  const iceEq = new Float64Array(nx);

  for (let i = 0; i < nx; i++) {
    if (is_floating[i] || H[i] < 10) continue;

    const C_i = C_basal ? C_basal[i] : C_SLIDING;
    const meltWaterEq = basalMeltProductionWaterEq(u_base[i], N_eff[i], C_i);
    waterEq[i] = meltWaterEq;
    iceEq[i] = meltWaterEq * (RHO_FRESH / RHO_ICE);
  }

  return { waterEq, iceEq };
}

/**
 * Evolve subglacial water amount for one time step.
 *
 * @param W Current water amount (normalized, 0-1)
 * @param basalMeltWaterEq Grounded basal meltwater production (m/yr water eq.)
 * @param is_floating Floating mask
 * @param grid Model grid
 * @param params User parameters
 * @param dt Time step (years)
 * @returns Updated water amount W
 */
export function evolveHydrology(
  W: Float64Array,
  basalMeltWaterEq: Float64Array,
  is_floating: Uint8Array,
  grid: ModelGrid,
  params: UserParams,
  dt: number,
  surfaceMelt?: Float64Array,
): Float64Array {
  const { nx, dx } = grid;
  const W_new = new Float64Array(nx);
  // drain_efficiency is now a true rate coefficient (1/yr): higher → faster
  // drainage → lower steady-state W. Clamp to avoid a zero denominator in the
  // equivalent W_eq ≈ source / k_drain.
  const k_drain = Math.max(0.05, params.drain_efficiency);

  for (let i = 0; i < nx; i++) {
    if (is_floating[i]) {
      W_new[i] = 0;
      continue;
    }

    // Source combines grounded basal meltwater (geothermal + friction) with
    // a fraction of surface melt routed to the bed via crevasses / moulins
    // (Zwally feedback). Surface melt is the negative part of SMB.
    const basal = basalMeltWaterEq[i];
    const sfc = surfaceMelt != null ? Math.max(0, surfaceMelt[i]) * SURFACE_TO_BED_FRACTION : 0;
    const source = (basal + sfc) / WATER_LAYER_THICKNESS_SCALE;
    const drainage = W[i] * k_drain;

    // No-flux boundaries via mirrored saturation.
    const left = i > 0 ? W[i - 1] : W[i];
    const right = i < nx - 1 ? W[i + 1] : W[i];
    const diffusion = K_HYDRAULIC * (right - 2 * W[i] + left) / (dx * dx);

    W_new[i] = W[i] + dt * (source - drainage + diffusion);

    // Clamp to [0, 1]
    W_new[i] = clamp(W_new[i], 0, 1);
  }

  return W_new;
}

/**
 * Compute effective pressure from ice overburden and water pressure.
 *
 * N(x) = ρ_i * g * H(x) * (1 - k_w * W(x))
 *
 * @param H Ice thickness (m)
 * @param W Normalized water amount (0-1)
 * @param is_floating Floating mask
 * @returns Effective pressure (Pa)
 */
export function computeEffectivePressure(
  H: Float64Array,
  W: Float64Array,
  is_floating: Uint8Array,
): Float64Array {
  const nx = H.length;
  const N = new Float64Array(nx);

  for (let i = 0; i < nx; i++) {
    if (is_floating[i] || H[i] < 1) {
      N[i] = 0;
    } else {
      const overburden = RHO_ICE * G * H[i];
      N[i] = overburden * (1 - K_WATER * W[i]);
      N[i] = Math.max(N[i], 0); // Effective pressure can't be negative
    }
  }

  return N;
}
