/**
 * Ocean melt parameterization for ice shelf basal melting.
 *
 * ḃ_shelf(x) = γ_T * (T_ocean - T_f)² * F(depth)
 *
 * where:
 *   γ_T = thermal exchange coefficient
 *   T_ocean = user-controlled ocean temperature
 *   T_f = pressure-dependent freezing point
 *   F(depth) = depth-dependent scaling factor
 */

import {
  GAMMA_T, T_FREEZING_SURFACE, T_FREEZING_DEPTH,
  T_OCEAN_BASE, RHO_ICE, RHO_WATER,
} from './constants';
import type { UserParams } from './types';

/**
 * Compute the pressure-dependent freezing point of seawater.
 *
 * @param depth Depth below sea surface (m, positive downward)
 * @returns Freezing point temperature (°C)
 */
function freezingPoint(depth: number): number {
  return T_FREEZING_SURFACE + T_FREEZING_DEPTH * depth;
}

/**
 * Compute ocean basal melt rate at a single floating point.
 *
 * @param iceThickness Ice thickness (m) at this floating point
 * @param bedrock Bedrock elevation (m, negative below sea level)
 * @param params User parameters
 * @param T_ocean_base Base ocean temperature (°C)
 * @param curtainFactor Reduction factor from geoengineering curtain (0-1, 1=no curtain)
 * @returns Basal melt rate (m/yr, positive = melting)
 */
export function computeOceanMeltPoint(
  iceThickness: number,
  _bedrock: number,
  params: UserParams,
  T_ocean_base: number = T_OCEAN_BASE,
  curtainFactor: number = 1.0,
): number {
  // Draft of ice shelf: how deep the bottom of the ice extends
  const draft = iceThickness * RHO_ICE / RHO_WATER;

  // Depth of ice shelf base below sea level
  const depth = draft;

  // Freezing point at this depth
  const Tf = freezingPoint(depth);

  // Ocean temperature (with user offset and curtain effect)
  const T_ocean = T_ocean_base + params.T_ocean_delta * curtainFactor;

  // Thermal driving
  const deltaT = T_ocean - Tf;

  if (deltaT <= 0) return 0; // No melting if ocean is at/below freezing

  // Quadratic melt rate: γ_T * (T_ocean - T_f)²
  let meltRate = GAMMA_T * deltaT * deltaT;

  // Depth-dependent scaling: melt is stronger at deeper ice shelf bases
  const depthScale = 1.0 + 0.5 * depth / 1000; // Mild depth enhancement
  meltRate *= depthScale;

  return meltRate;
}

/**
 * Compute ocean melt for the entire profile.
 * Only applies to floating ice (where is_floating[i] = 1).
 *
 * @param H Ice thickness (m)
 * @param b Bedrock elevation (m)
 * @param is_floating Floating mask (1=floating, 0=grounded)
 * @param params User parameters
 * @param T_ocean_base Base ocean temperature
 * @param curtain_pos Curtain position in meters from divide (optional)
 * @param curtain_eff Curtain efficiency 0-1 (optional)
 * @returns Basal melt rate profile (m/yr)
 */
export function computeOceanMelt(
  H: Float64Array,
  b: Float64Array,
  is_floating: Uint8Array,
  params: UserParams,
  T_ocean_base: number = T_OCEAN_BASE,
  x?: Float64Array,
): Float64Array {
  const nx = H.length;
  const melt = new Float64Array(nx);

  for (let i = 0; i < nx; i++) {
    if (!is_floating[i]) continue;
    if (H[i] < 1) continue;

    // Check if a geoengineering curtain applies
    let curtainFactor = 1.0;
    if (
      params.curtain_position != null &&
      params.curtain_efficiency != null &&
      x != null
    ) {
      const curtainPos = params.curtain_position * 1000; // km → m
      if (x[i] > curtainPos) {
        // Ice is seaward of the curtain → curtain reduces warm water access
        curtainFactor = 1.0 - params.curtain_efficiency;
      }
    }

    melt[i] = computeOceanMeltPoint(H[i], b[i], params, T_ocean_base, curtainFactor);
  }

  return melt;
}
