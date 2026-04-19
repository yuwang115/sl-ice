/**
 * Ice temperature parameterization.
 *
 * Instead of solving the full heat equation, we use an analytical
 * temperature profile based on the Peclet number.
 *
 * T(σ) = T_s + (T_b - T_s) * f(σ, Pe)
 *
 * where f is a function of sigma and Peclet number,
 * σ = 0 at bed, σ = 1 at surface.
 */

import {
  GLEN_N, KAPPA_ICE_YR, PRESSURE_MELTING,
  Q_COLD, Q_WARM, A0_COLD, A0_WARM, R_GAS, SEC_PER_YEAR,
  STRAIN_RATE_MIN, LAPSE_RATE, T_ATM_BASE, POLAR_AMPLIFICATION,
} from './constants';
import type { ModelGrid, UserParams } from './types';

/**
 * Compute the Robin-type analytical temperature profile.
 * Uses erfc-based solution for advection-diffusion in an ice column.
 *
 * @param sigma Vertical coordinate (0=bed, 1=surface)
 * @param Pe Peclet number = accumulation * H / kappa
 * @returns Normalized temperature: 0 at surface, 1 at bed
 */
function robinProfile(sigma: number, Pe: number): number {
  if (Pe < 0.01) {
    // Low Pe: linear profile (diffusion-dominated)
    return 1 - sigma;
  }
  // Robin analytical solution approximation
  // f(σ) = erfc(sqrt(Pe/2) * σ) / erfc(0) ≈ exp(-Pe*σ²/2) type
  // Simplified: use exponential approximation
  const arg = Pe * sigma * sigma / 2;
  if (arg > 50) return 0; // surface-like
  return Math.exp(-arg) * (1 - sigma) / (1 - sigma * Math.exp(-Pe / 2));
}

/**
 * Compute temperature at a given (x, sigma) point.
 *
 * @param surfaceTemp Surface temperature (°C)
 * @param H Ice thickness (m)
 * @param accumRate Accumulation rate (m/yr ice eq.)
 * @returns Temperature (°C)
 */
export function iceTemperature(
  sigma: number,
  surfaceTemp: number,
  H: number,
  accumRate: number,
): number {
  if (H < 1) return surfaceTemp;

  // Peclet number
  const Pe = Math.max(0, accumRate) * H / KAPPA_ICE_YR;

  // Basal temperature: geothermal gradient + pressure melting point limit
  const pressureMeltingPoint = PRESSURE_MELTING * H; // Negative, so Tpm < 0
  const geothermalGradient = 20; // Approximate basal warming (°C) above surface temp
  const basalTemp = Math.min(
    surfaceTemp + geothermalGradient,
    pressureMeltingPoint
  );

  // Profile: σ=0 is bed, σ=1 is surface
  const f = robinProfile(sigma, Pe);
  return surfaceTemp + (basalTemp - surfaceTemp) * f;
}

/**
 * Compute Glen's flow law rate factor A(T) using Arrhenius relationship.
 *
 * A(T) = A₀ * exp(-Q / (R * T_K))
 *
 * @param T Temperature in °C
 * @returns Flow rate factor A in Pa⁻ⁿ yr⁻¹
 */
export function flowRateFactor(T: number): number {
  const T_K = T + 273.15;
  if (T_K < 1) return 1e-25 * SEC_PER_YEAR; // Safety

  const T_threshold = 263.15; // -10°C in Kelvin
  let A: number;

  if (T_K < T_threshold) {
    A = A0_COLD * Math.exp(-Q_COLD / (R_GAS * T_K));
  } else {
    A = A0_WARM * Math.exp(-Q_WARM / (R_GAS * T_K));
  }

  // Convert from Pa⁻³ s⁻¹ to Pa⁻³ yr⁻¹
  return A * SEC_PER_YEAR;
}

/**
 * Compute effective viscosity η at a grid point.
 *
 * η = ½ * A⁻¹/ⁿ * ε̇ₑ^((1-n)/n)
 *
 * @param A Flow rate factor (Pa⁻³ yr⁻¹)
 * @param strainRateEff Effective strain rate (yr⁻¹)
 * @returns Effective viscosity (Pa·yr)
 */
export function effectiveViscosity(A: number, strainRateEff: number): number {
  const n = GLEN_N;
  // Regularize strain rate
  const eps = Math.max(strainRateEff, STRAIN_RATE_MIN);
  // η = 0.5 * A^(-1/n) * eps^((1-n)/n)
  const eta = 0.5 * Math.pow(A, -1 / n) * Math.pow(eps, (1 - n) / n);
  // Clamp to prevent extreme values
  return Math.min(Math.max(eta, 1e5), 1e20);
}

/**
 * Compute surface temperature at a given location.
 *
 * The user-supplied ΔT is interpreted as a global anomaly; the ice surface
 * sees a polar-amplified version (POLAR_AMPLIFICATION ≈ 1.8 for Antarctica,
 * consistent with CMIP6 land-surface ratios). Elevation enters through the
 * free-atmosphere lapse rate.
 *
 * @param surfaceElevation Surface elevation (m)
 * @param T_atm_delta Global temperature offset (°C)
 * @returns Surface temperature (°C)
 */
export function surfaceTemperature(
  surfaceElevation: number,
  T_atm_delta: number,
  T_atm_base: number = T_ATM_BASE,
): number {
  return T_atm_base + T_atm_delta * POLAR_AMPLIFICATION
       - LAPSE_RATE * surfaceElevation / 1000;
}

/**
 * Compute the 2D viscosity field for the entire grid.
 *
 * @param u Current velocity field (nx * nz)
 * @param H Ice thickness (nx)
 * @param s Surface elevation (nx)
 * @param smb Surface mass balance (nx)
 * @param grid Model grid
 * @param params User parameters
 * @param T_atm_base Base atmospheric temperature
 * @returns Viscosity field (nx * nz)
 */
export function computeViscosityField(
  u: Float64Array,
  H: Float64Array,
  s: Float64Array,
  smb: Float64Array,
  grid: ModelGrid,
  params: UserParams,
  T_atm_base: number,
): Float64Array {
  const { nx, nz, dx, dsigma } = grid;
  const eta = new Float64Array(nx * nz);

  for (let i = 0; i < nx; i++) {
    if (H[i] < 1) {
      // No ice: set default viscosity
      for (let j = 0; j < nz; j++) {
        eta[i * nz + j] = 1e15;
      }
      continue;
    }

    const Ts = surfaceTemperature(s[i], params.T_atm_delta, T_atm_base);

    for (let j = 0; j < nz; j++) {
      const sigma = grid.sigma[j];
      const k = i * nz + j;

      // Temperature at this point
      const T = iceTemperature(sigma, Ts, H[i], Math.max(0, smb[i]));

      // Flow rate factor
      const A = flowRateFactor(T);

      // Strain rates
      let dudx = 0;
      if (i > 0 && i < nx - 1) {
        dudx = (u[(i + 1) * nz + j] - u[(i - 1) * nz + j]) / (2 * dx);
      } else if (i === 0) {
        dudx = (u[1 * nz + j] - u[0 * nz + j]) / dx;
      } else {
        dudx = (u[(nx - 1) * nz + j] - u[(nx - 2) * nz + j]) / dx;
      }

      let dudsigma = 0;
      if (j > 0 && j < nz - 1) {
        dudsigma = (u[i * nz + j + 1] - u[i * nz + j - 1]) / (2 * dsigma);
      } else if (j === 0) {
        dudsigma = (u[i * nz + 1] - u[i * nz + 0]) / dsigma;
      } else {
        dudsigma = (u[i * nz + nz - 1] - u[i * nz + nz - 2]) / dsigma;
      }

      // Vertical shear: (1/(2H)) * du/dσ
      const dudz = dudsigma / (2 * H[i]);

      // Effective strain rate
      const epsEff = Math.sqrt(dudx * dudx + dudz * dudz + STRAIN_RATE_MIN * STRAIN_RATE_MIN);

      eta[k] = effectiveViscosity(A, epsEff);
    }
  }

  return eta;
}
