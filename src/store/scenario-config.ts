/**
 * Fetch and validate scenario configs from /data/scenarios.
 */

import { BASE } from '../base';
import type { ScenarioConfig } from '../engine/types';

const DEFAULT_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;

export interface FetchScenarioOptions {
  signal?: AbortSignal;
  /** Total attempts for transient failures (network errors, HTTP 5xx). */
  attempts?: number;
}

/** A failure that retrying will not fix (HTTP 4xx, malformed config). */
class PermanentScenarioError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Check the fields the physics engine needs before handing the config to the worker. */
export function parseScenarioConfig(data: unknown, scenario: string): ScenarioConfig {
  const valid = isRecord(data)
    && typeof data.name === 'string'
    && typeof data.domain_length === 'number'
    && Array.isArray(data.bedrock) && data.bedrock.length > 0
    && typeof data.bedrock[0] === 'number'
    && typeof data.T_atm_base === 'number'
    && typeof data.T_ocean_base === 'number'
    && typeof data.P_snow_base === 'number'
    && typeof data.enable_hydrology === 'boolean';
  if (!valid) {
    throw new PermanentScenarioError(`Scenario "${scenario}" is malformed`);
  }
  return data as unknown as ScenarioConfig;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

async function fetchOnce(scenario: string, signal?: AbortSignal): Promise<ScenarioConfig> {
  const url = `${BASE}/data/scenarios/${scenario}.json`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const message = `HTTP ${response.status} loading ${url}`;
    throw response.status < 500 ? new PermanentScenarioError(message) : new Error(message);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    throw new PermanentScenarioError(`Scenario "${scenario}" is not valid JSON`);
  }
  return parseScenarioConfig(data, scenario);
}

/**
 * Fetch a scenario config by name (e.g. "scenario_b_misi"). Rejects on HTTP
 * errors and malformed configs; transient failures are retried with
 * exponential backoff. Aborting rejects with the signal's reason.
 */
export async function fetchScenarioConfig(
  scenario: string,
  { signal, attempts = DEFAULT_ATTEMPTS }: FetchScenarioOptions = {},
): Promise<ScenarioConfig> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchOnce(scenario, signal);
    } catch (err: unknown) {
      if (signal?.aborted || err instanceof PermanentScenarioError || attempt >= attempts) {
        throw err;
      }
    }
    await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), signal);
  }
}

/** True when `err` came from an aborted request rather than a real failure. */
export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (err instanceof DOMException && err.name === 'AbortError');
}
