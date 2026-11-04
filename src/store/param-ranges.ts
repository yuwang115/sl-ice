/**
 * Ranges of the sidebar parameter sliders, shared with code that reasons
 * about what a player can actually set (e.g. achievements).
 */

import type { UserParams } from '../engine/types';

export interface SliderRange {
  min: number;
  max: number;
  step: number;
}

export const PARAM_SLIDER_RANGES = {
  T_atm_delta: { min: -5, max: 10, step: 0.1 },
  T_ocean_delta: { min: -2, max: 5, step: 0.1 },
  precip_scale: { min: 0.5, max: 2.0, step: 0.05 },
  drain_efficiency: { min: 0.1, max: 5.0, step: 0.1 },
  mici_sensitivity: { min: 0.1, max: 3.0, step: 0.1 },
  curtain_position: { min: 0, max: 800, step: 10 },
  curtain_efficiency: { min: 0, max: 1, step: 0.05 },
} as const satisfies Partial<Record<keyof UserParams, SliderRange>>;
