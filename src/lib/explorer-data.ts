/**
 * Fetch + validate the explorer's JSON data (flowline catalog, scenario configs).
 * Both are untrusted input: HTTP errors and malformed payloads surface as
 * descriptive errors instead of an empty UI or a crashing physics worker.
 */

import { BASE } from '../base';
import type { FlowlineCatalogEntry } from '../components/game/FlowlineListPanel';
import type { ScenarioConfig } from '../engine/types';

export const FLOWLINE_CATALOG_URL = `${BASE}/data/flowline-catalog.json`;

export function scenarioUrl(scenario: string): string {
  return `${BASE}/data/scenarios/${scenario}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CATALOG_STRING_FIELDS = [
  'id', 'scenario', 'name_en', 'name_zh', 'description_en', 'description_zh',
  'region', 'basin', 'location_en', 'location_zh',
] as const;
const CATALOG_ARRAY_FIELDS = ['path_lonlat', 'key_facts_en', 'key_facts_zh'] as const;

/** Minimal shape check for the fields the explorer UI dereferences. */
export function isFlowlineCatalogEntry(value: unknown): value is FlowlineCatalogEntry {
  if (!isRecord(value)) return false;
  return CATALOG_STRING_FIELDS.every((key) => typeof value[key] === 'string')
    && CATALOG_ARRAY_FIELDS.every((key) => Array.isArray(value[key]));
}

/** Minimal shape check before handing a config to the physics worker. */
export function isScenarioConfig(value: unknown): value is ScenarioConfig {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string'
    && typeof value.domain_length === 'number' && Number.isFinite(value.domain_length) && value.domain_length > 0
    && Array.isArray(value.bedrock) && value.bedrock.length >= 2;
}

async function fetchJson(url: string, what: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${what}`);
  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(`${what} is not valid JSON`);
  }
}

/** Load the flowline catalog; invalid entries are dropped, an unusable file throws. */
export async function fetchFlowlineCatalog(signal?: AbortSignal): Promise<FlowlineCatalogEntry[]> {
  const data = await fetchJson(FLOWLINE_CATALOG_URL, 'the flowline catalog', signal);
  if (!Array.isArray(data)) throw new Error('The flowline catalog is not a list');

  const entries = data.filter(isFlowlineCatalogEntry);
  if (entries.length < data.length) {
    console.warn(`[explorer] skipped ${data.length - entries.length} malformed catalog entries`);
  }
  if (entries.length === 0) throw new Error('The flowline catalog has no usable entries');
  return entries;
}

/** Load one scenario config (e.g. "flowlines/thwaites-flowline-01"). */
export async function fetchScenarioConfig(scenario: string, signal?: AbortSignal): Promise<ScenarioConfig> {
  const data = await fetchJson(scenarioUrl(scenario), `scenario "${scenario}"`, signal);
  if (!isScenarioConfig(data)) throw new Error(`Scenario "${scenario}" is malformed`);
  return data;
}
