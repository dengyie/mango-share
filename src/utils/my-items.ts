/**
 * Guest checklist storage and login merge for "my items".
 *
 * Guests mark cards opened/wanted without an account — the state lives in
 * localStorage. On register/login the local entries are merged with the
 * server list last-writer-wins per item key (updatedAt), the merged set is
 * uploaded, and the authoritative server list comes back.
 */
import type { MyItemEntry, MyItemStatus, MyItemType } from '../types/account';

export const MY_ITEMS_STORAGE_KEY = 'mangoshare_my_items_v1';

/** key = `${itemType}:${itemId}` */
export type SyncItemEntry = Omit<MyItemEntry, 'status'> & { status: MyItemStatus | '' };
export type MyItemsMap = Map<string, SyncItemEntry>;

export function itemKey(itemType: MyItemType, itemId: string): string {
  return `${itemType}:${itemId}`;
}

export function loadLocalItems(scope?: string): MyItemsMap {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(scope ? `${MY_ITEMS_STORAGE_KEY}:${scope}` : MY_ITEMS_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as SyncItemEntry[];
    if (!Array.isArray(parsed)) return new Map();
    const map: MyItemsMap = new Map();
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry.itemType === 'string' &&
        typeof entry.itemId === 'string' &&
        (entry.status === 'opened' || entry.status === 'wanted' || entry.status === '') &&
        typeof entry.updatedAt === 'number'
      ) {
        map.set(itemKey(entry.itemType as MyItemType, entry.itemId), {
          itemType: entry.itemType as MyItemType,
          itemId: entry.itemId,
          status: entry.status,
          updatedAt: entry.updatedAt,
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function saveLocalItems(items: MyItemsMap | SyncItemEntry[], scope?: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const list = Array.isArray(items) ? items : Array.from(items.values());
    window.localStorage.setItem(scope ? `${MY_ITEMS_STORAGE_KEY}:${scope}` : MY_ITEMS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.warn('Failed to persist my-items checklist:', e);
    return false;
  }
}

export function clearLocalItems(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MY_ITEMS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Merges the local guest map with the server list, last-writer-wins per
 * item key. Returns the merged map (server entries may win).
 */
export function mergeItems(local: MyItemsMap, server: SyncItemEntry[]): MyItemsMap {
  const merged: MyItemsMap = new Map(local);
  for (const entry of server) {
    if (!entry || typeof entry.itemId !== 'string') continue;
    const key = itemKey(entry.itemType, entry.itemId);
    const existing = merged.get(key);
    if (!existing || entry.updatedAt > existing.updatedAt || (entry.updatedAt === existing.updatedAt && (entry.status === '' || existing.status !== ''))) {
      merged.set(key, entry);
    }
  }
  return merged;
}

/**
 * Computes the entries that must be pushed to the server: merged entries
 * that are missing on the server or newer than the server copy.
 */
export function diffForUpload(merged: MyItemsMap, server: SyncItemEntry[]): SyncItemEntry[] {
  const serverByKey = new Map(server.map((e) => [itemKey(e.itemType, e.itemId), e]));
  const out: SyncItemEntry[] = [];
  for (const entry of merged.values()) {
    const remote = serverByKey.get(itemKey(entry.itemType, entry.itemId));
    if (!remote || entry.updatedAt > remote.updatedAt || (entry.updatedAt === remote.updatedAt && entry.status === '' && remote.status !== '')) {
      out.push(entry);
    }
  }
  return out;
}

/** Single-item setter used by the mark controls; `null` unmarks. */
export function upsertItem(
  items: MyItemsMap,
  itemType: MyItemType,
  itemId: string,
  status: MyItemStatus | null
): MyItemsMap {
  const next = new Map(items);
  const key = itemKey(itemType, itemId);
  next.set(key, { itemType, itemId, status: status ?? '', updatedAt: Math.max(Date.now(), (items.get(key)?.updatedAt ?? 0) + 1) });
  return next;
}
