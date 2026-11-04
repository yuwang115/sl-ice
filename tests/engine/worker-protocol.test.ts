import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ModelState, PhysicsCommand, PhysicsStatePayload, PhysicsWorkerMessage, ScenarioConfig, UserParams,
} from '../../src/engine/types';

const physicsMock = vi.hoisted(() => ({
  initializeModel: vi.fn(),
  stepPhysics: vi.fn(),
  extractStatePayload: vi.fn(),
}));

vi.mock('../../src/engine/physics', () => physicsMock);

const SCENARIO = { name: 'Test', enable_hydrology: true } as ScenarioConfig;
const posted: PhysicsWorkerMessage[] = [];

function fakeModel(config: ScenarioConfig): ModelState {
  const params: UserParams = {
    T_atm_delta: 0,
    T_ocean_delta: 0,
    precip_scale: 1,
    drain_efficiency: 1,
    enable_hydrology: config.enable_hydrology,
  };
  return { year: 0, params, velocity_stale: false, u: new Float64Array(4) } as unknown as ModelState;
}

function send(command: PhysicsCommand): PhysicsWorkerMessage[] {
  const start = posted.length;
  self.onmessage?.({ data: command } as MessageEvent<PhysicsCommand>);
  return posted.slice(start);
}

beforeEach(async () => {
  posted.length = 0;
  vi.resetModules();
  physicsMock.initializeModel.mockReset().mockImplementation(fakeModel);
  physicsMock.stepPhysics.mockReset().mockImplementation((state: ModelState, _config, dt: number) => {
    state.year += dt;
    return { state, events: [] };
  });
  physicsMock.extractStatePayload.mockReset().mockImplementation(
    (state: ModelState) => ({ year: state.year, events: [] }) as unknown as PhysicsStatePayload,
  );
  vi.spyOn(self, 'postMessage').mockImplementation((message: unknown) => {
    posted.push(message as PhysicsWorkerMessage);
  });
  await import('../../src/engine/worker');
});

describe('physics worker protocol', () => {
  it('answers init with one state tagged with the init epoch, user params applied', () => {
    const params = { ...fakeModel(SCENARIO).params, T_atm_delta: 3, enable_hydrology: false };
    const replies = send({ type: 'init', payload: { scenario: SCENARIO, params, epoch: 4 } });

    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ type: 'state_update', epoch: 4 });
    const model = physicsMock.extractStatePayload.mock.calls[0][0] as ModelState;
    expect(model.params).toMatchObject({ T_atm_delta: 3, enable_hydrology: false });
    expect(model.velocity_stale).toBe(true);
  });

  it('replies with an error, instead of staying silent, to step or reset before init', () => {
    const step = send({ type: 'step', payload: { dt: 0.1, nSteps: 1 } });
    const reset = send({ type: 'reset', payload: { epoch: 2 } });

    expect(step).toEqual([expect.objectContaining({ type: 'error' })]);
    expect(step[0]).toMatchObject({ payload: { command: 'step', initialized: false } });
    expect(reset).toEqual([expect.objectContaining({ type: 'error', epoch: 2 })]);
  });

  it('reports a failed init and forgets the previous model', () => {
    send({ type: 'init', payload: { scenario: SCENARIO, epoch: 1 } });
    physicsMock.initializeModel.mockImplementationOnce(() => {
      throw new Error('bad bedrock');
    });

    const replies = send({ type: 'init', payload: { scenario: SCENARIO, epoch: 2 } });
    expect(replies).toEqual([expect.objectContaining({ type: 'error', epoch: 2 })]);
    expect(replies[0]).toMatchObject({ payload: { message: 'bad bedrock', initialized: false } });

    const step = send({ type: 'step', payload: { dt: 0.1, nSteps: 1 } });
    expect(step[0]).toMatchObject({ type: 'error', payload: { command: 'step' } });
  });

  it('sends exactly one error reply when a step throws', () => {
    send({ type: 'init', payload: { scenario: SCENARIO, epoch: 1 } });
    physicsMock.stepPhysics.mockImplementationOnce(() => {
      throw new Error('diverged');
    });

    const replies = send({ type: 'step', payload: { dt: 0.1, nSteps: 3 } });
    expect(replies).toEqual([expect.objectContaining({ type: 'error', epoch: 1 })]);
    expect(replies[0]).toMatchObject({ payload: { command: 'step', initialized: true } });
  });

  it('accepts overlay flags before the first init', () => {
    send({ type: 'update_params', payload: { overlayFlags: { send2DField: true } } });
    const [reply] = send({ type: 'init', payload: { scenario: SCENARIO, epoch: 1 } });

    expect(reply.type).toBe('state_update');
    if (reply.type === 'state_update') expect(reply.payload.u_2d).toBeInstanceOf(Float64Array);
  });

  it('re-applies params on reset and echoes the reset epoch on later steps', () => {
    send({ type: 'init', payload: { scenario: SCENARIO, epoch: 1 } });
    const params = { ...fakeModel(SCENARIO).params, precip_scale: 1.5 };
    send({ type: 'reset', payload: { params, epoch: 2 } });
    const [stepReply] = send({ type: 'step', payload: { dt: 0.1, nSteps: 1 } });

    expect(stepReply).toMatchObject({ type: 'state_update', epoch: 2 });
    const model = physicsMock.stepPhysics.mock.calls[0][0] as ModelState;
    expect(model.params.precip_scale).toBe(1.5);
  });
});
