import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PhysicsCommand, PhysicsWorkerMessage } from '../../src/engine/types';
import { useGameStore } from '../../src/store/game-store';
import {
  HISTORY_MAX_POINTS, appendHistory, usePhysicsStore, type PhysicsHistoryPoint,
} from '../../src/store/physics-store';
import { useUIStore } from '../../src/store/ui-store';
import { gameEvent, physicsState, scenarioConfig } from './fixtures';

class FakeWorker {
  static latest: FakeWorker | null = null;
  posted: PhysicsCommand[] = [];
  onmessage: ((event: MessageEvent<PhysicsWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor() {
    FakeWorker.latest = this;
  }

  postMessage(command: PhysicsCommand): void {
    this.posted.push(command);
  }

  terminate(): void {}

  reply(message: PhysicsWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<PhysicsWorkerMessage>);
  }

  lastCommand(): PhysicsCommand {
    return this.posted[this.posted.length - 1];
  }
}

const physics = () => usePhysicsStore.getState();

function startWorker(): FakeWorker {
  physics().initWorker();
  if (!FakeWorker.latest) throw new Error('worker not created');
  return FakeWorker.latest;
}

function stateUpdate(epoch: number, year: number, events = physicsState().events): PhysicsWorkerMessage {
  return { type: 'state_update', payload: physicsState({ year, events }), epoch };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('Worker', FakeWorker);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useGameStore.setState(useGameStore.getInitialState(), true);
  useUIStore.setState({ overlayMode: 'none' });
});

afterEach(() => {
  physics().destroyWorker();
  usePhysicsStore.setState({ epoch: 0, scenario: null, lastError: null });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('scenario epochs', () => {
  it('drops replies from the previous scenario without clearing the busy flag', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    worker.reply(stateUpdate(1, 0));
    expect(physics().step(0.1, 1)).toBe(true);

    // Reload while that step is still in flight: its reply is from epoch 1.
    physics().loadScenario(scenarioConfig({ name: 'Next' }));
    worker.reply(stateUpdate(1, 0.1));
    expect(physics().state).toBeNull();
    expect(physics().isWorkerBusy).toBe(true);

    worker.reply(stateUpdate(2, 0));
    expect(physics().state?.year).toBe(0);
    expect(physics().isWorkerBusy).toBe(false);
  });

  it('starts a new epoch on reset', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    worker.reply(stateUpdate(1, 0));
    physics().step(0.1, 1);

    physics().reset();
    expect(worker.lastCommand()).toMatchObject({ type: 'reset', payload: { epoch: 2 } });
    worker.reply(stateUpdate(1, 0.1));
    expect(physics().state).toBeNull();
    worker.reply(stateUpdate(2, 0));
    expect(physics().state).not.toBeNull();
  });
});

describe('commands', () => {
  it('sends the game params and overlay flag with init, clearing unset optional params', () => {
    useGameStore.getState().setMode('sandbox');
    useGameStore.getState().setParam('T_atm_delta', 2);
    useUIStore.setState({ overlayMode: 'strain' });
    const worker = startWorker();

    physics().loadScenario(scenarioConfig());
    const init = worker.lastCommand();
    expect(init.type).toBe('init');
    expect(init.payload.epoch).toBe(1);
    expect(init.payload.overlayFlags).toEqual({ send2DField: true });
    expect(init.payload.params).toMatchObject({ T_atm_delta: 2, enable_hydrology: false });
    expect(init.payload.params).toHaveProperty('curtain_position', undefined);
  });

  it('re-applies the current params on reset', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    useGameStore.getState().setParam('precip_scale', 1.5);

    physics().reset();
    expect(worker.lastCommand().payload.params).toMatchObject({ precip_scale: 1.5 });
  });

  it('mirrors the complete param set so a removed optional param is cleared', () => {
    const worker = startWorker();
    physics().updateParams({ ...useGameStore.getState().params });
    const { params } = worker.lastCommand().payload;
    expect(params).toHaveProperty('enable_mici', undefined);
    expect(params).toHaveProperty('mici_sensitivity', undefined);
  });
});

describe('worker errors', () => {
  it('marks the model uninitialised after a failed init and stops dispatching steps', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    worker.reply({
      type: 'error',
      payload: { message: 'bad config', command: 'init', initialized: false },
      epoch: 1,
    });

    expect(physics().isWorkerBusy).toBe(false);
    expect(physics().isInitialized).toBe(false);
    expect(physics().lastError).toBe('bad config');
    expect(physics().step(0.1, 1)).toBe(false);
  });

  it('keeps stepping after a recoverable step error', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    worker.reply(stateUpdate(1, 0));
    physics().step(0.1, 1);
    worker.reply({
      type: 'error',
      payload: { message: 'solver diverged', command: 'step', initialized: true },
      epoch: 1,
    });

    expect(physics().isInitialized).toBe(true);
    expect(physics().step(0.1, 1)).toBe(true);
  });
});

describe('state updates', () => {
  it('keeps the same events array while messages carry no events', () => {
    const worker = startWorker();
    physics().loadScenario(scenarioConfig());
    worker.reply(stateUpdate(1, 0));
    const quiet = physics().events;
    worker.reply(stateUpdate(1, 0.1));
    expect(physics().events).toBe(quiet);

    worker.reply(stateUpdate(1, 0.2, [gameEvent('shelf_collapsed')]));
    expect(physics().events).toHaveLength(1);
  });
});

describe('appendHistory', () => {
  it(`stays within ${HISTORY_MAX_POINTS} points, keeping the first and the recent points`, () => {
    let history: PhysicsHistoryPoint[] = [];
    for (let year = 0; year < 3 * HISTORY_MAX_POINTS; year++) {
      history = appendHistory(history, physicsState({ year }));
      expect(history.length).toBeLessThanOrEqual(HISTORY_MAX_POINTS);
    }
    const lastYear = 3 * HISTORY_MAX_POINTS - 1;
    expect(history[0].year).toBe(0);
    expect(history.at(-1)?.year).toBe(lastYear);
    expect(history.slice(-30).map((p) => p.year)).toEqual(
      Array.from({ length: 30 }, (_, i) => lastYear - 29 + i),
    );
    const years = history.map((p) => p.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});
