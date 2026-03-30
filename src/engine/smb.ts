/**
 * Surface Mass Balance (SMB) parameterization.
 *
 * Uses a simplified temperature–elevation parameterization:
 *   ȧ(x) = min(a_max, a_0 + λ_a * (T_ref - T_atm + Γ * s(x)/1000))
 *
 * Plus ablation via a simplified Positive Degree Day (PDD) model:
 *   ablation = d_melt * max(0, T_local)   when T_local > 0°C
 *
 * Net SMB = accumulation - ablation
 */

import {
  SMB_A_MAX, SMB_A0, SMB_LAMBDA, LAPSE_RATE,
  PDD_FACTOR, T_ATM_BASE,
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
  // Local temperature at the ice surface (accounting for lapse rate)
  const T_atm = T_atm_base + params.T_atm_delta;
  const T_local = T_atm - LAPSE_RATE * surfaceElevation / 1000;

  // Accumulation: temperature-dependent snowfall
  // Colder → more precipitation stays as snow
  // Scale by user's precipitation multiplier
  const T_ref = 0; // Reference temperature for max accumulation
  const accumBase = P_snow_base * params.precip_scale;
  const accumTempFactor = 1.0 + SMB_LAMBDA * (T_ref - T_local);
  const accumulation = Math.min(SMB_A_MAX * params.precip_scale, Math.max(0, accumBase * accumTempFactor));

  // Ablation: Positive Degree Day model (simplified)
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
