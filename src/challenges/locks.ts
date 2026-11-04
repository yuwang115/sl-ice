/**
 * Physics switches a challenge is built around. Undercurrents is about
 * subglacial water and The Cliff about cliff failure; switching those
 * processes off would win the challenge without playing it.
 */

import type { ChallengeDefinition, UserParams } from '../engine/types';

const CHALLENGE_SWITCHES = ['enable_hydrology', 'enable_mici'] as const;

export type ChallengeSwitch = (typeof CHALLENGE_SWITCHES)[number];

/** Switches `challenge` turns on, which stay on for the whole attempt. */
export function lockedSwitches(challenge: ChallengeDefinition | undefined): ReadonlySet<keyof UserParams> {
  if (!challenge) return new Set();
  return new Set(CHALLENGE_SWITCHES.filter((key) => challenge.initial_params[key] === true));
}
