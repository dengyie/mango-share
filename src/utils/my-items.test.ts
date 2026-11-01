/**
 * Tests for the guest checklist storage and the login merge:
 * localStorage round-trip with hostile payloads, last-writer-wins merge,
 * upload diffing, and single-item upserts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MyItemEntry } from '../types/account';
import {
  MY_ITEMS_STORAGE_KEY,
  clearLocalItems,
  diffForUpload,
  itemKey,
  loadLocalItems,
  mergeItems,
  saveLocalItems,
  upsertItem,
} from './my-items';

function entry(
  itemType: string,
  itemId: string,
  status: 'opened' | 'wanted',
  updatedAt: number
): MyItemEntry {
  return { itemType: itemType as MyItemEntry['itemType'], itemId, status, updatedAt };
}

function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('itemKey', () => {
  it('joins type and id with a colon', () => {
    expect(itemKey('u-card', 'dup_card')).toBe('u-card:dup_card');
  });
});

describe('upsertItem', () => {
  it('adds an entry with a fresh updatedAt and does not mutate the input', () => {
    const before = new Map();
    const next = upsertItem(before, 'sim-card', 'esim-1', 'opened');
    expect(next.get('sim-card:esim-1')?.status).toBe('opened');
    expect(next.get('sim-card:esim-1')?.updatedAt).toBeGreaterThan(0);
    expect(before.size).toBe(0);
  });

  it('persists a deletion so an older server copy cannot resurrect it', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    const deleted = upsertItem(new Map(), 'perk', 'p1', null);
    saveLocalItems(deleted);
    const restored = loadLocalItems();
    expect(restored.get('perk:p1')?.status).toBe('');
    expect(mergeItems(restored, [entry('perk', 'p1', 'wanted', 1)]).get('perk:p1')?.status).toBe('');
  });
});

describe('mergeItems', () => {
  it('prefers the newer local entry over a stale server copy', () => {
    const local = new Map([[itemKey('u-card', 'a'), entry('u-card', 'a', 'opened', 200)]]);
    const server = [entry('u-card', 'a', 'wanted', 100)];
    expect(mergeItems(local, server).get('u-card:a')?.status).toBe('opened');
  });

  it('prefers the newer server entry on equal-or-newer updatedAt', () => {
    const local = new Map([[itemKey('u-card', 'a'), entry('u-card', 'a', 'opened', 100)]]);
    const server = [entry('u-card', 'a', 'wanted', 100)];
    expect(mergeItems(local, server).get('u-card:a')?.status).toBe('wanted');
  });

  it('keeps local-only entries and adopts server-only entries', () => {
    const local = new Map([[itemKey('perk', 'p'), entry('perk', 'p', 'wanted', 5)]]);
    const server = [entry('ai-station', 's1', 'opened', 9)];
    const merged = mergeItems(local, server);
    expect(merged.get('perk:p')?.status).toBe('wanted');
    expect(merged.get('ai-station:s1')?.status).toBe('opened');
  });

  it('skips malformed server entries', () => {
    const server = [{ itemType: 'u-card', status: 'opened', updatedAt: 1 } as unknown as MyItemEntry];
    expect(mergeItems(new Map(), server).size).toBe(0);
  });
});

describe('diffForUpload', () => {
  it('uploads entries missing on the server or strictly newer', () => {
    const merged = new Map<string, MyItemEntry>([
      [itemKey('u-card', 'new'), entry('u-card', 'new', 'opened', 300)],
      [itemKey('u-card', 'fresh'), entry('u-card', 'fresh', 'opened', 300)],
      [itemKey('u-card', 'same'), entry('u-card', 'same', 'wanted', 100)],
    ]);
    const server = [entry('u-card', 'fresh', 'wanted', 200), entry('u-card', 'same', 'wanted', 100)];
    const diff = diffForUpload(merged, server);
    expect(diff.map((e) => e.itemId).sort()).toEqual(['fresh', 'new']);
  });

  it('returns an empty diff when everything is in sync', () => {
    const server = [entry('u-card', 'a', 'opened', 1)];
    const merged = new Map([[itemKey('u-card', 'a'), server[0]]]);
    expect(diffForUpload(merged, server)).toEqual([]);
  });
});

describe('localStorage round-trip', () => {
  it('saves and reloads the checklist', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    const map = new Map<string, MyItemEntry>([
      [itemKey('u-card', 'a'), entry('u-card', 'a', 'opened', 123)],
    ]);
    saveLocalItems(map);
    expect(loadLocalItems().get('u-card:a')).toEqual(entry('u-card', 'a', 'opened', 123));
    clearLocalItems();
    expect(loadLocalItems().size).toBe(0);
  });

  it('filters invalid entries and survives corrupted JSON', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem(
      MY_ITEMS_STORAGE_KEY,
      JSON.stringify([
        entry('sim-card', 'ok', 'wanted', 7),
        { itemType: 'sim-card', itemId: 'no-status', updatedAt: 8 },
        { itemType: 'sim-card', itemId: 'bad-status', status: 'nope', updatedAt: 9 },
        'junk',
      ])
    );
    const loaded = loadLocalItems();
    expect(loaded.size).toBe(1);
    expect(loaded.get('sim-card:ok')?.status).toBe('wanted');

    storage.setItem(MY_ITEMS_STORAGE_KEY, '{not json');
    expect(loadLocalItems().size).toBe(0);
  });
});
