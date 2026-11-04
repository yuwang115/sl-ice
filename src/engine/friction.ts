/**
 * Basal friction law shared by the momentum solver and frictional heating.
 *
 *   τ_b = C · (N / N₀)^q · |u_b|^m,        m = q = 1/3
 *
 * i.e. the Budd et al. (1984) form u_b ∝ τ_b³ / N, written with a
 * normalised effective pressure. C is a Weertman coefficient in
 * Pa (m/yr)^(-m) (MISMIP value converted to yearly units, or the inverted
 * C(x) field). N₀ = ρ_i g H is the ice overburden, so N / N₀ = 1 − k_w·W
 * is a dimensionless hydrological lubrication factor: a dry bed recovers
 * the plain Weertman law, and a saturated bed (W = 1, k_w = 0.9) speeds
 * sliding up 10× at fixed stress.
 *
 * Two earlier forms are deliberately avoided:
 *  - C · N (dimensional Pa) inflates τ_b by ~10⁷ and freezes every grounded
 *    node to its bed.
 *  - q = 1 gives u_b ∝ N⁻³ (1000× at saturation); with frictional heating
 *    feeding basal water this runs away to the velocity cap within a few
 *    model years on hydrology-enabled flowlines.
 */

import { RHO_ICE, G, SLIDING_M } from './constants';

/** Velocity regularisation for the m − 1 < 0 power (m/yr). */
export const U_SLIDE_REG = 1e-2;

/** Exponent q on the normalised effective pressure (Budd: q = m = 1/3). */
export const LUBRICATION_EXPONENT = 1 / 3;

/**
 * Linearised drag coefficient β (Pa·yr/m) such that τ_b = β · u_b.
 *
 * @param C       Weertman coefficient (Pa (m/yr)^(-m))
 * @param u_b     Basal speed (m/yr)
 * @param N_eff   Effective pressure (Pa)
 * @param H       Ice thickness (m)
 */
export function basalDragCoefficient(C: number, u_b: number, N_eff: number, H: number): number {
  const overburden = RHO_ICE * G * H;
  if (!(overburden > 0) || !(C > 0)) return 0;
  const lubrication = Math.min(1, Math.max(0, N_eff / overburden));
  const speed = Math.sqrt(u_b * u_b + U_SLIDE_REG * U_SLIDE_REG);
  return C * Math.pow(lubrication, LUBRICATION_EXPONENT) * Math.pow(speed, SLIDING_M - 1);
}
