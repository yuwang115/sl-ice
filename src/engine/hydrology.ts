/**
 * Simplified subglacial hydrology module.
 *
 * Computes effective pressure N from a steady-state water film model:
 *
 *   N(x) = ρ_i g H(x) * (1 - k_w * W(x))
 *
 * Water evolution:
 *   ∂W/∂t = Q_melt / (ρ_w * L_f) - W / τ_drain + ∂/∂x(K_w * W * ∂ψ/∂x)
 *
 * where:
 *   W = normalized subglacial water amount (0 = dry, 1 = flooded)
 *   Q_melt = basal melt production (geothermal + frictional heating)
 *   τ_drain = drainage timescale (user-controlled)
 *   K_w = hydraulic conductivity
 *   ψ = hydraulic potential gradient
 */

import {
  RHO_ICE, RHO_WATER, RHO_FRESH, G,
  K_WATER, K_HYDRAULIC,
  L_FUSION, Q_GEOTHERMAL, C_SLIDING, SLIDING_M,
} from './constants';
import { clamp } from './matrix/utils';
import type { ModelGrid, UserParams } from './types';

/**
 * Compute basal melt production from geothermal and frictional heating.
 *
 * Q_melt = Q_geo + τ_b * u_b
 *
 * @param u_base Basal velocity (m/yr)
 * @param H Ice thickness (m)
 * @param N_eff Effective pressure (Pa)
 * @returns Basal melt production (m/yr of water)
 */
function basalMeltProduction(
  u_base: number,
  _H: number,
  N_eff: number,
): number {
  // Frictional heating: τ_b * u_b
  const u_b = Math.abs(u_base);
  const beta = C_SLIDING * Math.pow(u_b + 1e-6, SLIDING_M - 1) * Math.max(N_eff, 0);
  const tau_b = beta * u_b;
  const frictionalHeat = tau_b * u_b; // W/m² (in units of Pa * m/yr)

  // Convert to consistent units: Q_geo in W/m², frictional in Pa·m/yr
  // 1 Pa·m/yr = 1 J/(m²·yr) ... need to convert to W/m²
  // Actually we work in yearly units, so convert Q_geo to J/(m²·yr)
  const SEC_PER_YEAR = 365.25 * 24 * 3600;
  const Q_geo_yearly = Q_GEOTHERMAL * SEC_PER_YEAR; // J/(m²·yr)

  // Total heat in J/(m²·yr)
  const totalHeat = Q_geo_yearly + frictionalHeat;

  // Melt rate: Q / (ρ_w * L_f) in m/yr
  return totalHeat / (RHO_FRESH * L_FUSION);
}

/**
 * Evolve subglacial water amount for one time step.
 *
 * @param W Current water amount (normalized, 0-1)
 * @param H Ice thickness (m)
 * @param b Bedrock elevation (m)
 * @param s Surface elevation (m)
 * @param u_base Basal velocity (m/yr)
 * @param N_eff Current effective pressure (Pa)
 * @param is_floating Floating mask
 * @param grid Model grid
 * @param params User parameters
 * @param dt Time step (years)
 * @returns Updated water amount W
 */
export function evolveHydrology(
  W: Float64Array,
  H: Float64Array,
  b: Float64Array,
  s: Float64Array,
  u_base: Float64Array,
  N_eff: Float64Array,
  is_floating: Uint8Array,
  grid: ModelGrid,
  params: UserParams,
  dt: number,
): Float64Array {
  const { nx, dx } = grid;
  const W_new = new Float64Array(nx);
  const tau_drain = Math.max(0.1, params.drain_efficiency);

  for (let i = 0; i < nx; i++) {
    if (is_floating[i] || H[i] < 10) {
      W_new[i] = 0;
      continue;
    }

    // Source: basal melt production
    const meltProd = basalMeltProduction(u_base[i], H[i], N_eff[i]);

    // Sink: drainage
    const drainage = W[i] / tau_drain;

    // Diffusion: ∂/∂x(K_w * W * ∂ψ/∂x)
    // Hydraulic potential: ψ = ρ_i * g * s + (ρ_w - ρ_i) * g * b
    let diffusion = 0;
    if (i > 0 && i < nx - 1) {
      const psi_left = RHO_ICE * G * s[i - 1] + (RHO_WATER - RHO_ICE) * G * b[i - 1];
      const psi_center = RHO_ICE * G * s[i] + (RHO_WATER - RHO_ICE) * G * b[i];
      const psi_right = RHO_ICE * G * s[i + 1] + (RHO_WATER - RHO_ICE) * G * b[i + 1];

      const W_right = 0.5 * (W[i] + (i < nx - 1 ? W[i + 1] : W[i]));
      const W_left = 0.5 * (W[i] + (i > 0 ? W[i - 1] : W[i]));

      const flux_right = K_HYDRAULIC * W_right * (psi_right - psi_center) / dx;
      const flux_left = K_HYDRAULIC * W_left * (psi_center - psi_left) / dx;

      diffusion = (flux_right - flux_left) / dx;
    }

    // Time integration
    W_new[i] = W[i] + dt * (meltProd - drainage + diffusion);

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
