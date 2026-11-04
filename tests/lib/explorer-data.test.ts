import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFlowlineCatalog,
  fetchScenarioConfig,
  isFlowlineCatalogEntry,
  isScenarioConfig,
} from '../../src/lib/explorer-data';

function catalogEntry(id: string) {
  return {
    id,
    scenario: `flowlines/${id}`,
    name_en: id,
    name_zh: id,
    description_en: '',
    description_zh: '',
    region: 'west',
    basin: 'Thwaites',
    location_en: '',
    location_zh: '',
    path_lonlat: [[-77.6, -79.5]],
    key_facts_en: [],
    key_facts_zh: [],
  };
}

function mockFetch(body: unknown, init: { ok?: boolean; status?: number; badJson?: boolean } = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => (init.badJson ? Promise.reject(new SyntaxError('bad')) : Promise.resolve(body)),
  };
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('catalog / scenario validation', () => {
  it('accepts well-formed entries and rejects incomplete ones', () => {
    expect(isFlowlineCatalogEntry(catalogEntry('a'))).toBe(true);
    expect(isFlowlineCatalogEntry({ ...catalogEntry('a'), key_facts_en: undefined })).toBe(false);
    expect(isFlowlineCatalogEntry(null)).toBe(false);
  });

  it('requires a usable domain and bedrock profile in scenarios', () => {
    expect(isScenarioConfig({ name: 'x', domain_length: 600, bedrock: [0, -100] })).toBe(true);
    expect(isScenarioConfig({ name: 'x', domain_length: 0, bedrock: [0, -100] })).toBe(false);
    expect(isScenarioConfig({ name: 'x', domain_length: 600, bedrock: [] })).toBe(false);
    expect(isScenarioConfig('<html>')).toBe(false);
  });
});

describe('fetchFlowlineCatalog', () => {
  it('throws on HTTP errors instead of resolving to an empty catalog', async () => {
    mockFetch(null, { ok: false, status: 404 });
    await expect(fetchFlowlineCatalog()).rejects.toThrow(/HTTP 404/);
  });

  it('throws when the payload is not JSON or not a list', async () => {
    mockFetch(null, { badJson: true });
    await expect(fetchFlowlineCatalog()).rejects.toThrow(/not valid JSON/);
    mockFetch({ entries: [] });
    await expect(fetchFlowlineCatalog()).rejects.toThrow(/not a list/);
  });

  it('drops malformed entries and keeps the rest', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch([catalogEntry('a'), { id: 'broken' }, catalogEntry('b')]);
    const entries = await fetchFlowlineCatalog();
    expect(entries.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('fetchScenarioConfig', () => {
  it('rejects malformed scenarios before they reach the physics worker', async () => {
    mockFetch({ name: 'x' });
    await expect(fetchScenarioConfig('flowlines/x')).rejects.toThrow(/malformed/);
  });

  it('returns valid scenarios', async () => {
    mockFetch({ name: 'x', domain_length: 600, bedrock: [0, -100] });
    await expect(fetchScenarioConfig('flowlines/x')).resolves.toMatchObject({ domain_length: 600 });
  });
});
