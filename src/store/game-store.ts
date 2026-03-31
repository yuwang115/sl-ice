/**
 * Game state store — manages mode, challenges, scores.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMode, SimulationSpeed, ChallengeStatus, UserParams } from '../engine/types';

interface ChallengeProgress {
  id: number;
  status: ChallengeStatus;
  bestScore?: number;
  startYear?: number;
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
      challengeProgress: s.challengeProgress.map((c) =>
        c.id === id ? { ...c, status: 'in_progress' as ChallengeStatus } : c
      ),
    })),
  completeChallenge: (id, won, score) =>
    set((s) => {
      const progress = s.challengeProgress.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: (won ? 'won' : 'lost') as ChallengeStatus,
            bestScore: score != null ? Math.max(score, c.bestScore || 0) : c.bestScore,
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
      return { challengeProgress: progress, currentChallenge: null };
    }),
  completedChallenges: () =>
    get()
      .challengeProgress.filter((c) => c.status === 'won')
      .map((c) => c.id),

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
    }),
  },
));
