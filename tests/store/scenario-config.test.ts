import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchScenarioConfig } from '../../src/store/scenario-config';
import { scenarioConfig } from './fixtures';

function respond(status: number, body: unknown = scenarioConfig()): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchScenarioConfig', () => {
  it('rejects an HTTP error without retrying a client error', async () => {
    const fetchMock = vi.fn(async () => respond(404, 'not found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchScenarioConfig('missing')).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a server error and returns the config once it loads', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchScenarioConfig('scenario_b_misi');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ name: 'Test scenario' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a config that lacks the fields the engine needs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(200, { name: 'x', bedrock: [] })));
    await expect(fetchScenarioConfig('broken')).rejects.toThrow(/malformed/);
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchScenarioConfig('x', { signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
