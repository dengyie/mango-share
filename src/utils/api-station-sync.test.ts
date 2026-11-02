import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appendImportedStations,
  loadManagedStations,
  mergeNewDefaultStations,
  mergePublicStations,
  parseNewApiChannelsJson,
} from './api-station-sync';
import type { AiStationItem } from '../types/ai-station';
import type { PublicStationChannel } from '../types/api-sync';

const channel = (base_url: string): PublicStationChannel => ({ id: 1, name: base_url, type: 1, status: 1, base_url, models: [], group: '', priority: 1, weight: 1, tag: '', response_time: 0, test_time: 0 });

const station = (id: string): AiStationItem => ({
  id,
  name: `Station ${id}`,
  category: 'Gateway',
  portalUrl: `https://${id}.example`,
  apiBaseUrl: `https://${id}.example/v1`,
  models: [],
  authType: 'DirectKey',
  quotaDesc: '',
  healthState: 'online',
  turnstile: false,
  tags: [],
});

// loadManagedStations 读裸 localStorage，node 环境需同时 stub window 判型与
// localStorage 全局（catalog-index 走 window.localStorage，两者入口不同）。
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('mergeNewDefaultStations', () => {
  it('appends bundled defaults that a pre-existing cache is missing', () => {
    const cached = [station('yiming'), station('amnew')];
    const defaults = [station('yiming'), station('amnew'), station('bili-translate')];
    const merged = mergeNewDefaultStations(cached, defaults);
    expect(merged.map((s) => s.id)).toEqual(['yiming', 'amnew', 'bili-translate']);
  });

  it('returns the cache untouched when no defaults are missing', () => {
    const cached = [station('yiming'), station('custom-1')];
    const defaults = [station('yiming')];
    expect(mergeNewDefaultStations(cached, defaults)).toEqual(cached);
  });

  it('lets the cached entry win over a default with the same id', () => {
    const cached = [{ ...station('yiming'), name: 'User-renamed' }];
    const defaults = [{ ...station('yiming'), name: 'Bundled name' }];
    expect(mergeNewDefaultStations(cached, defaults)[0].name).toBe('User-renamed');
  });

  it('adds each missing default once even if the cache holds duplicate ids', () => {
    const cached = [station('custom-1'), station('custom-1')];
    const defaults = [station('yiming')];
    const merged = mergeNewDefaultStations(cached, defaults);
    expect(merged.filter((s) => s.id === 'yiming')).toHaveLength(1);
  });
});

describe('loadManagedStations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges newly bundled defaults into a stored v2 cache', () => {
    const stored = [station('yiming'), station('custom-1')];
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', fakeStorage({
      mangoshare_custom_ai_stations_v2: JSON.stringify(stored),
    }));
    const defaults = [station('yiming'), station('bili-translate')];
    expect(loadManagedStations(defaults).map((s) => s.id)).toEqual(['yiming', 'custom-1', 'bili-translate']);
  });

  it('falls back to defaults when the cache is absent', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', fakeStorage());
    const defaults = [station('yiming')];
    expect(loadManagedStations(defaults)).toEqual(defaults);
  });
});

describe('AI Hub identity', () => {
  it('keeps separate imports with the same tag distinct', () => {
    const a = parseNewApiChannelsJson(JSON.stringify({ name: 'Alpha', tag: 'same', base_url: 'https://a.example' }))[0];
    const b = parseNewApiChannelsJson(JSON.stringify({ name: 'Beta', tag: 'same', base_url: 'https://b.example' }))[0];
    expect(a.id).not.toBe(b.id);
  });
  it('preserves old IDs and avoids duplicates in a single import batch', () => {
    const existing = parseNewApiChannelsJson(JSON.stringify({name:'Old', base_url:'https://old.example'}))[0];
    existing.id = 'custom-old-1';
    const imports = parseNewApiChannelsJson(JSON.stringify([{name:'One', base_url:'https://one.example'}, {name:'One', base_url:'https://two.example'}]));
    const result = appendImportedStations([existing], imports);
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('custom-old-1');
  });
  it('distinguishes colliding dynamic slugs and remains stable on reorder', () => {
    const channels = [channel('https://a.b'), channel('https://a-b')];
    const first = mergePublicStations([], channels).stations;
    const second = mergePublicStations([], [...channels].reverse()).stations;
    expect(new Set(first.map(s => s.id)).size).toBe(2);
    expect(Object.fromEntries(first.map(s => [s.portalUrl, s.id]))).toEqual(Object.fromEntries(second.map(s => [s.portalUrl, s.id])));
  });
  it('does not turn an old measurement into current online status', () => {
    const managed = parseNewApiChannelsJson(JSON.stringify({name:'existing', base_url:'https://existing.example', status: 0}))[0];
    const ch = {...channel('https://existing.example'), response_time: 30};
    expect(mergePublicStations([managed], [ch]).stations[0].healthState).toBe('offline');
  });
  it('does not collide with an existing managed ID', () => {
    const managed = parseNewApiChannelsJson(JSON.stringify({name:'existing', base_url:'https://existing.example'}))[0];
    managed.id = 'upstream-a-b';
    const stations = mergePublicStations([managed], [channel('https://a.b')]).stations;
    expect(new Set(stations.map(s => s.id)).size).toBe(2);
  });
});
