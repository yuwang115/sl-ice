/**
 * Game state store — manages mode, challenges, scores.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  GameMode, SimulationSpeed, ChallengeStatus, UserParams, PhysicsStatePayload, GameEvent,
  ScenarioConfig,
} from '../engine/types';
import { challenges } from '../challenges';
import {
  buildCheckState, resolveChallengeOutcome, winConditionAtFinalStretch, type ChallengeOutcome,
} from '../challenges/outcome';
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
  outcome: ChallengeOutcome;
  score: number;
  stars: number; // 0-3
  elapsedYears: number;
  paramChanges: number; // Parameter adjustments made during the attempt
  photoFinish: boolean; // The win condition first held within the final stretch
}

/** User-facing text in both UI languages. */
export interface LocalizedMessage {
  en: string;
  zh: string;
}

/** A physics event waiting in the info-bubble queue; localized at render time. */
export interface PendingEvent {
  id: string;
  type: GameEvent['type'];
  message_en: string;
  message_zh: string;
  severity: GameEvent['severity'];
}

/** Top-level views App can show. Physics only steps while 'simulation' is visible. */
export type ActiveView =
  | 'explorer' | 'challenge_list' | 'challenge_result' | 'real_world_selector' | 'simulation';

interface GameStore {
  // Mode
  mode: GameMode;
  /** Switching to a different mode starts it from default parameters. */
  setMode: (mode: GameMode) => void;

  // Simulation control
  speed: SimulationSpeed;
  setSpeed: (speed: SimulationSpeed) => void;
  isRunning: boolean;
  setRunning: (running: boolean) => void;
  /** Run at normal speed. Launch paths use this so a new run never starts paused. */
  startSimulation: () => void;
  stepsPerFrame: number;

  // User parameters (the sliders)
  params: UserParams;
  /** A user adjustment (sidebar); counts as a challenge parameter change. */
  setParam: <K extends keyof UserParams>(key: K, value: UserParams[K]) => void;
  /** Programmatic merge; not counted as a parameter change. */
  setParams: (params: Partial<UserParams>) => void;
  /** Replace every param with its default, then apply `overrides`; not counted. */
  resetParams: (overrides?: Partial<UserParams>) => void;
  /** Params to initialise `config` with. Free-play scenarios adopt their hydrology default. */
  paramsForScenario: (config: ScenarioConfig) => UserParams;

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
  /** Whether the win condition held when the final stretch began; null before then. */
  challengeFinalStretchWinning: boolean | null;
  _challengeHysteresisLocked: boolean;
  _lastParamKey: keyof UserParams | null;
  _lastParamChangeAt: number;
  evaluateChallenge: (physicsState: PhysicsStatePayload) => void;
  dismissChallengeResult: () => void;

  // Scenario loading failures, shown to the user until dismissed or a load succeeds
  loadError: LocalizedMessage | null;
  setLoadError: (error: LocalizedMessage | null) => void;

  // Selected real-world region
  selectedRegion: string | null;
  selectRegion: (region: string | null) => void;

  // Selected 3D-ICE explorer flow line
  selectedFlowline: string | null;
  /** Picking a flowline launches its simulation in explorer mode; null returns to the map. */
  selectFlowline: (id: string | null) => void;

  // Event display
  pendingEvents: PendingEvent[];
  /** Queue an event; one entry per event type (newest wording wins), capped in length. */
  addEvent: (event: GameEvent) => void;
  dismissEvent: (id: string) => void;
  clearEvents: () => void;
}

export const DEFAULT_PARAMS: Readonly<UserParams> = {
  T_atm_delta: 0,
  T_ocean_delta: 0,
  precip_scale: 1.0,
  drain_efficiency: 1.0,
  enable_hydrology: false,
};

/** Slider input closer than this to the previous change of the same parameter is one adjustment. */
const PARAM_ADJUSTMENT_GAP_MS = 400;

/** Longest info-bubble queue; the displayed entry and the newest ones are kept. */
const MAX_PENDING_EVENTS = 5;

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

function clampParams<T extends Partial<UserParams>>(params: T): T {
  const clamped: Partial<UserParams> = { ...params };
  for (const key of Object.keys(clamped) as (keyof UserParams)[]) {
    const value = clamped[key];
    if (value !== undefined) {
      (clamped as Record<string, unknown>)[key] = clampParam(key, value);
    }
  }
  return clamped as T;
}

export function stepsForSpeed(speed: SimulationSpeed): number {
  // The BP solver is expensive enough that large step batches freeze the UI.
  return speed === 'paused' ? 0 : speed === 'normal' ? 1 : speed === 'fast' ? 2 : 5;
}

export function starsForScore(score: number): number {
  return score >= 85 ? 3 : score >= 60 ? 2 : score > 0 ? 1 : 0;
}

function recordAttempt(progress: ChallengeProgress, won: boolean, score?: number): ChallengeProgress {
  return {
    ...progress,
    // A challenge once won stays won; replaying and failing it does not revoke that.
    status: won || progress.status === 'won' ? 'won' : 'lost',
    bestScore: score != null ? Math.max(score, progress.bestScore || 0) : progress.bestScore,
    bestStars: won
      ? Math.max(score == null ? 0 : starsForScore(score), progress.bestStars || 0)
      : progress.bestStars,
  };
}

/** Unlock locked challenges whose unlock condition the won challenges now satisfy. */
function unlockChallenges(progress: ChallengeProgress[]): ChallengeProgress[] {
  const wonIds = progress.filter((c) => c.status === 'won').map((c) => c.id);
  return progress.map((c) => {
    if (c.status !== 'locked') return c;
    const definition = challenges.find((d) => d.id === c.id);
    return definition?.unlock_condition?.(wonIds) ? { ...c, status: 'available' } : c;
  });
}

function enqueueEvent(queue: PendingEvent[], event: GameEvent): PendingEvent[] {
  const content = {
    message_en: event.message_en,
    message_zh: event.message_zh,
    severity: event.severity,
  };
  const pendingIndex = queue.findIndex((e) => e.type === event.type);
  if (pendingIndex >= 0) {
    return queue.map((e, i) => (i === pendingIndex ? { ...e, ...content } : e));
  }
  const next = [...queue, { id: `${Date.now()}-${Math.random()}`, type: event.type, ...content }];
  if (next.length <= MAX_PENDING_EVENTS) return next;
  return [next[0], ...next.slice(next.length - (MAX_PENDING_EVENTS - 1))];
}

type ViewState = Pick<
  GameStore, 'mode' | 'currentChallenge' | 'challengeResult' | 'selectedRegion' | 'selectedFlowline'
>;

/** The view App renders for this state (mirrors its routing). */
export function selectActiveView(s: ViewState): ActiveView {
  if (s.challengeResult) return 'challenge_result';
  switch (s.mode) {
    case 'challenge':
      return s.currentChallenge !== null ? 'simulation' : 'challenge_list';
    case 'real_world':
      return s.selectedRegion ? 'simulation' : 'real_world_selector';
    case 'explorer':
    case 'menu':
      return s.selectedFlowline ? 'simulation' : 'explorer';
    default:
      return 'simulation';
  }
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
      challengeResult: mode === 'challenge' ? s.challengeResult : null,
      // Challenge params (MICI, curtain, ...) must not leak into the next mode.
      ...(mode !== s.mode ? { params: { ...DEFAULT_PARAMS }, loadError: null } : {}),
    })),

  speed: 'normal',
  setSpeed: (speed) => set({ speed, stepsPerFrame: stepsForSpeed(speed) }),
  isRunning: false,
  setRunning: (running) => set({ isRunning: running }),
  startSimulation: () =>
    set({ isRunning: true, speed: 'normal', stepsPerFrame: stepsForSpeed('normal') }),
  stepsPerFrame: 1,

  params: { ...DEFAULT_PARAMS },
  setParam: (key, value) =>
    set((s) => {
      const now = Date.now();
      const isNewAdjustment =
        key !== s._lastParamKey || now - s._lastParamChangeAt > PARAM_ADJUSTMENT_GAP_MS;
      const counting = s.currentChallenge !== null && s.challengeResult === null;
      return {
        params: { ...s.params, [key]: clampParam(key, value) },
        challengeParamChanges: s.challengeParamChanges + (counting && isNewAdjustment ? 1 : 0),
        _lastParamKey: key,
        _lastParamChangeAt: now,
      };
    }),
  setParams: (params) => set((s) => ({ params: { ...s.params, ...clampParams(params) } })),
  resetParams: (overrides = {}) =>
    set({ params: clampParams({ ...DEFAULT_PARAMS, ...overrides }) }),
  paramsForScenario: (config) => {
    const s = get();
    const hydrology = config.enable_hydrology;
    if (s.mode === 'challenge' || typeof hydrology !== 'boolean'
      || hydrology === s.params.enable_hydrology) {
      return s.params;
    }
    const params = { ...s.params, enable_hydrology: hydrology };
    set({ params });
    return params;
  },

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
      mode: 'challenge',
      currentChallenge: id,
      challengeStartYear: null,  // Will be captured from first physics update
      challengeInitialVolume: null,
      challengeResult: null,
      challengeParamChanges: 0,
      challengeFinalStretchWinning: null,
      _challengeHysteresisLocked: false,
      _lastParamKey: null,
      _lastParamChangeAt: 0,
      loadError: null,
      challengeProgress: s.challengeProgress.map((c) =>
        c.id === id
          ? { ...c, status: c.status === 'won' ? 'won' : 'in_progress', attempts: (c.attempts || 0) + 1 }
          : c
      ),
    })),
  completeChallenge: (id, won, score) =>
    set((s) => ({
      challengeProgress: unlockChallenges(
        s.challengeProgress.map((c) => (c.id === id ? recordAttempt(c, won, score) : c)),
      ),
    })),
  completedChallenges: () =>
    get()
      .challengeProgress.filter((c) => c.status === 'won')
      .map((c) => c.id),

  // Challenge evaluation
  challengeStartYear: null,
  challengeInitialVolume: null,
  challengeResult: null,
  challengeParamChanges: 0,
  challengeFinalStretchWinning: null,
  _challengeHysteresisLocked: false,
  _lastParamKey: null,
  _lastParamChangeAt: 0,

  evaluateChallenge: (physicsState) => {
    const s = get();
    const challenge = s.challengeResult
      ? undefined
      : challenges.find((c) => c.id === s.currentChallenge);
    if (!challenge) return;

    // The first state of an attempt is its baseline.
    if (s.challengeStartYear === null || s.challengeInitialVolume === null) {
      set({ challengeStartYear: physicsState.year, challengeInitialVolume: physicsState.volume });
      return;
    }

    const elapsed = physicsState.year - s.challengeStartYear;
    // hysteresis_locked is announced once as an event; latch it for the rest of the attempt.
    const hysteresisLocked = s._challengeHysteresisLocked
      || physicsState.events.some((e) => e.type === 'hysteresis_locked');
    const checkState = buildCheckState(physicsState, s.challengeInitialVolume, hysteresisLocked);
    const finalStretchWinning = s.challengeFinalStretchWinning
      ?? winConditionAtFinalStretch(challenge, checkState, elapsed);
    const tracking = {
      _challengeHysteresisLocked: hysteresisLocked,
      challengeFinalStretchWinning: finalStretchWinning,
    };
    const outcome = resolveChallengeOutcome(challenge, checkState, elapsed);

    if (!outcome) {
      if (hysteresisLocked !== s._challengeHysteresisLocked
        || finalStretchWinning !== s.challengeFinalStretchWinning) {
        set(tracking);
      }
      return;
    }

    const won = outcome === 'won';
    const score = won
      ? computeChallengeScore(challenge, physicsState, s.challengeInitialVolume, elapsed, s.challengeParamChanges)
      : 0;
    set({
      ...tracking,
      challengeResult: {
        challengeId: challenge.id,
        won,
        outcome,
        score,
        stars: starsForScore(score),
        elapsedYears: Math.round(elapsed),
        paramChanges: s.challengeParamChanges,
        photoFinish: won && finalStretchWinning === false,
      },
      isRunning: false,
    });
    get().completeChallenge(challenge.id, won, won ? score : undefined);
  },

  dismissChallengeResult: () => set({ challengeResult: null, currentChallenge: null }),

  loadError: null,
  setLoadError: (error) => set({ loadError: error }),

  selectedRegion: null,
  selectRegion: (region) => set({ selectedRegion: region }),

  selectedFlowline: null,
  selectFlowline: (id) =>
    set((s) => {
      if (id !== null) {
        // The flowline may be picked from the 'menu' landing, which has no sim controls.
        return {
          selectedFlowline: id,
          mode: 'explorer',
          currentChallenge: null,
          challengeResult: null,
          loadError: null,
          speed: 'normal',
          stepsPerFrame: stepsForSpeed('normal'),
        };
      }
      // Back to the map: the next flowline starts from default parameters.
      return s.selectedFlowline === null ? {} : { selectedFlowline: null, params: { ...DEFAULT_PARAMS } };
    }),

  pendingEvents: [],
  addEvent: (event) => set((s) => ({ pendingEvents: enqueueEvent(s.pendingEvents, event) })),
  dismissEvent: (id) =>
    set((s) => ({
      pendingEvents: s.pendingEvents.filter((e) => e.id !== id),
    })),
  clearEvents: () => set({ pendingEvents: [] }),
}),
  {
    name: 'sl-ice-game',
    partialize: (state) => ({
      challengeProgress: state.challengeProgress,
    } as Partial<GameStore>),
  },
));
