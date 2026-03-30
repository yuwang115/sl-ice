/**
 * Game state store — manages mode, challenges, scores.
 */

import { create } from 'zustand';
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

export const useGameStore = create<GameStore>((set, get) => ({
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
    set((s) => ({ params: { ...s.params, [key]: value } })),
  setParams: (params) =>
    set((s) => ({ params: { ...s.params, ...params } })),
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
      // Unlock challenge 7 if all others completed
      const completedIds = progress.filter((c) => c.status === 'won').map((c) => c.id);
      if (completedIds.length >= 6 && !completedIds.includes(7)) {
        const idx = progress.findIndex((c) => c.id === 7);
        if (idx >= 0) progress[idx] = { ...progress[idx], status: 'available' };
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
}));
