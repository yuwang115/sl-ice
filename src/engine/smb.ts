/**
 * Surface Mass Balance (SMB) parameterization.
 *
 * Three-term decomposition:
 *   1. Baseline snowfall P_snow_base (m/yr ice eq., scenario-provided).
 *   2. Spatial (elevation) modifier: colder interior accumulates more than
 *      warmer margins — captured by the un-perturbed lapse-rate temperature.
 *   3. Temporal (climate-change) modifier: a warmer atmosphere holds more
 *      water vapor, so precipitation responds via a Clausius–Clapeyron
 *      scaling exp(α·ΔT_polar) with α ≈ 0.07/K. Polar amplification is
 *      applied to the global ΔT so that ΔT_polar = POLAR_AMP · ΔT_atm.
 *
 * Ablation uses a simplified Positive-Degree-Day (PDD) model:
 *   ablation = PDD_FACTOR · max(0, T_local)   when T_local > 0°C
 *
 * Net SMB = accumulation − ablation (m/yr ice equivalent).
 *
 * Why the CC coupling matters: the previous parameterization used a single
 * linear factor (1 + λ·(T_ref − T_local)) that decreased as the climate
 * warmed — the opposite sign of the observed Antarctic response
 * (Palerme et al. 2017; Frieler et al. 2015). Decoupling the spatial and
 * temporal dependencies recovers the ~5–7%/K CC response observed and
 * projected for high-latitude continents.
 */

import {
  SMB_A_MAX, SMB_A0, SMB_LAMBDA, LAPSE_RATE,
  PDD_FACTOR, T_ATM_BASE, CC_SCALING, POLAR_AMPLIFICATION,
} from './constants';
import type { UserParams } from './types';

/**
 * Compute surface mass balance at a single point.
 *
 * @param surfaceElevation Surface elevation (m)
 * @param params User-controlled parameters
 * @param T_atm_base Base atmospheric temperature (°C)
 * @param P_snow_base Base snowfall rate (m/yr)
 * @returns SMB in m/yr ice equivalent (positive = accumulation)
 */
export function computeSMBPoint(
  surfaceElevation: number,
  params: UserParams,
  T_atm_base: number = T_ATM_BASE,
  P_snow_base: number = SMB_A0,
): number {
  // Polar-amplified atmospheric anomaly applied to the ice surface. A global
  // ΔT of 1 K corresponds to ~1.8 K over the Antarctic surface in CMIP6.
  const dT_polar = params.T_atm_delta * POLAR_AMPLIFICATION;

  // Baseline (unperturbed) local temperature — elevation only. Used to build
  // the spatial (interior-vs-margin) accumulation pattern without double-
  // counting the climate anomaly in the temperature-dependent factor.
  const T_local_baseline = T_atm_base - LAPSE_RATE * surfaceElevation / 1000;

  // Actual local surface temperature (for ablation / PDD) includes ΔT.
  const T_local = T_local_baseline + dT_polar;

  // Accumulation — three independent factors.
  const T_ref = 0; // reference temperature for the spatial factor
  const spatialFactor = 1.0 + SMB_LAMBDA * (T_ref - T_local_baseline);
  const ccFactor = Math.exp(CC_SCALING * dT_polar);
  const accumBase = P_snow_base * params.precip_scale * spatialFactor * ccFactor;
  const accumulation = Math.min(
    SMB_A_MAX * params.precip_scale * ccFactor,
    Math.max(0, accumBase),
  );

  // Ablation: Positive Degree Day model (simplified).
  let ablation = 0;
  if (T_local > 0) {
    ablation = PDD_FACTOR * T_local;
  }

  return accumulation - ablation;
}

/**
 * Compute SMB for the entire horizontal profile.
 *
 * @param s Surface elevation profile (m)
 * @param params User parameters
 * @param T_atm_base Base atmospheric temperature (°C)
 * @param P_snow_base Base snowfall rate (m/yr)
 * @returns SMB profile (m/yr)
 */
export function computeSMB(
  s: Float64Array,
  params: UserParams,
  T_atm_base: number = T_ATM_BASE,
  P_snow_base: number = SMB_A0,
): Float64Array {
  const nx = s.length;
  const smb = new Float64Array(nx);
  for (let i = 0; i < nx; i++) {
    smb[i] = computeSMBPoint(s[i], params, T_atm_base, P_snow_base);
  }
  return smb;
}
