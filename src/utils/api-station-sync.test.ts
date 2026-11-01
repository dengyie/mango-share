import { describe, expect, it } from 'vitest';
import { appendImportedStations, mergePublicStations, parseNewApiChannelsJson } from './api-station-sync';
import type { PublicStationChannel } from '../types/api-sync';

const channel = (base_url: string): PublicStationChannel => ({ id: 1, name: base_url, type: 1, status: 1, base_url, models: [], group: '', priority: 1, weight: 1, tag: '', response_time: 0, test_time: 0 });

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
