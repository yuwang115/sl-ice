/**
 * Game state store — manages mode, challenges, scores.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMode, SimulationSpeed, ChallengeStatus, UserParams, PhysicsStatePayload } from '../engine/types';
import { challenges } from '../challenges';
import { computeScore as computeChallengeScore } from '../engine/scoring';

interface ChallengeProgress {
  id: number;
  status: ChallengeStatus;
  bestScore?: number;
  bestStars?: number;
  startYear?: number;
  attempts?: number;
}

/** Result shown after challenge ends (before returning to list) */
export interface ChallengeResult {
  challengeId: number;
  won: boolean;
  score: number;
  stars: number; // 0-3
  elapsedYears: number;
}

interface GameStore {
  // Mode
  mode: GameMode;
  setMode: (mode: GameMode) => void;

  // Simulation control
  speed: SimulationSpeed;
  setSpeed: (speed: SimulationSpeed) => void;
  isRunning: boolean;
  setRunning: (running: boolean) => void;
  stepsPerFrame: number;

  // User parameters (the sliders)
  params: UserParams;
  setParam: <K extends keyof UserParams>(key: K, value: UserParams[K]) => void;
  setParams: (params: Partial<UserParams>) => void;
  resetParams: () => void;

  // Challenge state
  currentChallenge: number | null;
  challengeProgress: ChallengeProgress[];
  startChallenge: (id: number) => void;
  completeChallenge: (id: number, won: boolean, score?: number) => void;
  completedChallenges: () => number[];

  // Challenge evaluation state
  challengeStartYear: number | null;
  challengeInitialVolume: number | null;
  challengeResult: ChallengeResult | null;
  challengeParamChanges: number; // count of parameter adjustments
  _challengeHysteresisLocked: boolean;
  evaluateChallenge: (physicsState: PhysicsStatePayload) => void;
  dismissChallengeResult: () => void;
  incrementParamChanges: () => void;

  // Selected real-world region
  selectedRegion: string | null;
  selectRegion: (region: string | null) => void;

  // Selected 3D-ICE explorer flow line
  selectedFlowline: string | null;
  selectFlowline: (id: string | null) => void;

  // Event display
  pendingEvents: Array<{ id: string; type: string; message: string; severity: string }>;
  addEvent: (event: { type: string; message: string; severity: string }) => void;
  dismissEvent: (id: string) => void;
}

const defaultParams: UserParams = {
  T_atm_delta: 0,
  T_ocean_delta: 0,
  precip_scale: 1.0,
  drain_efficiency: 1.0,
  enable_hydrology: false,
};

/** Parameter bounds for numeric UserParams fields */
const PARAM_BOUNDS: Partial<Record<keyof UserParams, { min: number; max: number }>> = {
  T_atm_delta: { min: -20, max: 20 },
  T_ocean_delta: { min: -5, max: 10 },
  precip_scale: { min: 0, max: 5 },
  drain_efficiency: { min: 0.01, max: 10 },
  mici_sensitivity: { min: 0, max: 10 },
  curtain_position: { min: 0, max: 1000 },
  curtain_efficiency: { min: 0, max: 1 },
};

/** Clamp a parameter value to its valid range */
function clampParam<K extends keyof UserParams>(key: K, value: UserParams[K]): UserParams[K] {
  const bounds = PARAM_BOUNDS[key];
  if (bounds && typeof value === 'number') {
    return Math.max(bounds.min, Math.min(bounds.max, value)) as UserParams[K];
  }
  return value;
}

export const useGameStore = create<GameStore>()(persist(
  (set, get) => ({
  mode: 'explorer',
  setMode: (mode) =>
    set((s) => ({
      mode,
      // Clear sub-selections when leaving their parent mode
      selectedFlowline: mode === 'explorer' ? s.selectedFlowline : null,
      selectedRegion: mode === 'real_world' ? s.selectedRegion : null,
      currentChallenge: mode === 'challenge' ? s.currentChallenge : null,
    })),

  speed: 'normal',
  setSpeed: (speed) => {
    // The BP solver is expensive enough that large step batches freeze the UI.
    const stepsPerFrame = speed === 'paused' ? 0 : speed === 'normal' ? 1 : speed === 'fast' ? 2 : 5;
    set({ speed, stepsPerFrame });
  },
  isRunning: false,
  setRunning: (running) => set({ isRunning: running }),
  stepsPerFrame: 1,

  params: { ...defaultParams },
  setParam: (key, value) =>
    set((s) => ({ params: { ...s.params, [key]: clampParam(key, value) } })),
  setParams: (params) => {
    const clamped = { ...params };
    for (const key of Object.keys(clamped) as (keyof UserParams)[]) {
      if (clamped[key] !== undefined) {
        (clamped as Record<string, unknown>)[key] = clampParam(key, clamped[key] as UserParams[typeof key]);
      }
    }
    set((s) => ({ params: { ...s.params, ...clamped } }));
  },
  resetParams: () => set({ params: { ...defaultParams } }),

  currentChallenge: null,
  challengeProgress: [
    { id: 1, status: 'available' },
    { id: 2, status: 'available' },
    { id: 3, status: 'available' },
    { id: 4, status: 'available' },
    { id: 5, status: 'available' },
    { id: 6, status: 'available' },
    { id: 7, status: 'locked' },
    { id: 8, status: 'locked' },
  ],
  startChallenge: (id) =>
    set((s) => ({
      currentChallenge: id,
      challengeStartYear: null,  // Will be captured from first physics update
      challengeInitialVolume: null,
      challengeResult: null,
      challengeParamChanges: 0,
      challengeProgress: s.challengeProgress.map((c) =>
        c.id === id ? { ...c, status: 'in_progress' as ChallengeStatus, attempts: (c.attempts || 0) + 1 } : c
      ),
    })),
  completeChallenge: (id, won, score) =>
    set((s) => {
      const stars = score == null ? 0 : score >= 85 ? 3 : score >= 60 ? 2 : 1;
      const progress = s.challengeProgress.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: (won ? 'won' : 'lost') as ChallengeStatus,
            bestScore: score != null ? Math.max(score, c.bestScore || 0) : c.bestScore,
            bestStars: won ? Math.max(stars, c.bestStars || 0) : c.bestStars,
          };
        }
        return c;
      });
      // Unlock challenges based on completion
      const completedIds = progress.filter((c) => c.status === 'won').map((c) => c.id);
      // Challenge 7: unlocks when 6+ challenges completed
      if (completedIds.length >= 6 && !completedIds.includes(7)) {
        const idx = progress.findIndex((c) => c.id === 7);
        if (idx >= 0) progress[idx] = { ...progress[idx], status: 'available' };
      }
      // Challenge 8: unlocks when "The Cork" (id=3) is completed
      if (completedIds.includes(3) && !completedIds.includes(8)) {
        const idx = progress.findIndex((c) => c.id === 8);
        if (idx >= 0 && progress[idx].status === 'locked') {
          progress[idx] = { ...progress[idx], status: 'available' };
        }
      }
      return { challengeProgress: progress };
    }),
  completedChallenges: () =>
    get()
      .challengeProgress.filter((c) => c.status === 'won')
      .map((c) => c.id),

  // Challenge evaluation
  challengeStartYear: null,
  challengeInitialVolume: null,
  challengeResult: null,
  challengeParamChanges: 0,
  _challengeHysteresisLocked: false,
  incrementParamChanges: () => set((s) => ({ challengeParamChanges: s.challengeParamChanges + 1 })),

  evaluateChallenge: (physicsState) => {
    const s = get();
    if (!s.currentChallenge || s.challengeResult) return;

    const challenge = challenges.find((c) => c.id === s.currentChallenge);
    if (!challenge) return;

    // Capture initial state from first physics update
    const startYear = s.challengeStartYear;
    const initialVolume = s.challengeInitialVolume;
    if (startYear === null || initialVolume === null) {
      set({ challengeStartYear: physicsState.year, challengeInitialVolume: physicsState.volume });
      return; // Skip evaluation on first frame
    }

    const elapsed = physicsState.year - startYear;

    // Track hysteresis_locked persistently across frames
    let hysteresisLocked = s._challengeHysteresisLocked;
    if (!hysteresisLocked && physicsState.events.some((e) => e.type === 'hysteresis_locked')) {
      hysteresisLocked = true;
      set({ _challengeHysteresisLocked: true });
    }

    // Build a lightweight state adapter compatible with check_win/check_lose
    const stateAdapter = {
      volume: physicsState.volume,
      initial_volume: initialVolume,
      sea_level: physicsState.sea_level,
      is_misi_active: physicsState.is_misi_active,
      hysteresis_locked: hysteresisLocked,
      is_mici_active: physicsState.is_mici_active,
      cliff_height: physicsState.cliff_height,
      mici_calving_rate: physicsState.mici_calving_rate,
      shelf_exists: physicsState.shelf_exists,
    };

    // Check win/lose
    const won = challenge.check_win(stateAdapter as never, elapsed);
    const lost = challenge.check_lose(stateAdapter as never, elapsed);

    if (won || lost) {
      const score = won ? computeChallengeScore(challenge, physicsState, initialVolume, elapsed, s.challengeParamChanges) : 0;
      const stars = score >= 85 ? 3 : score >= 60 ? 2 : score > 0 ? 1 : 0;

      set({
        challengeResult: {
          challengeId: s.currentChallenge!,
          won,
          score,
          stars,
          elapsedYears: Math.round(elapsed),
        },
        isRunning: false,
      });

      // Persist to progress
      get().completeChallenge(s.currentChallenge!, won, won ? score : undefined);
    }
  },

  dismissChallengeResult: () => set({ challengeResult: null, currentChallenge: null }),

  selectedRegion: null,
  selectRegion: (region) => set({ selectedRegion: region }),

  selectedFlowline: null,
  selectFlowline: (id) => set({ selectedFlowline: id }),

  pendingEvents: [],
  addEvent: (event) =>
    set((s) => ({
      pendingEvents: [
        ...s.pendingEvents,
        { ...event, id: `${Date.now()}-${Math.random()}` },
      ],
    })),
  dismissEvent: (id) =>
    set((s) => ({
      pendingEvents: s.pendingEvents.filter((e) => e.id !== id),
    })),
}),
  {
    name: 'sl-ice-game',
    partialize: (state) => ({
      challengeProgress: state.challengeProgress,
    } as Partial<GameStore>),
  },
));
