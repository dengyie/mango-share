// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UserAccountProvider, useUserAccount, type UserAccountState } from './useUserAccount';
import * as api from '../utils/account-api';

vi.mock('../utils/account-api', async (importOriginal) => ({ ...(await importOriginal<typeof api>()), loginAccount: vi.fn(), logoutAccount: vi.fn(), fetchMyItems: vi.fn(), putMyItems: vi.fn(), verifyAccountSession: vi.fn() }));
const user = (id: number) => ({ id, email: `${id}@test.com`, displayName: '', createdAt: 1, role: 'user' as const });
function deferred<T>() { let resolve!: (x: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let state: UserAccountState;
let root: Root;
let container: HTMLDivElement;
function Probe() { state = useUserAccount(); return null; }
beforeEach(async () => {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) } });
  vi.clearAllMocks();
  vi.mocked(api.fetchMyItems).mockResolvedValue([]);
  vi.mocked(api.putMyItems).mockResolvedValue([]);
  vi.mocked(api.logoutAccount).mockResolvedValue();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => root.render(<UserAccountProvider><Probe /></UserAccountProvider>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it('adopts the server timestamp after a future-dated backlog is clamped and stops reuploading it', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
  await act(async () => state.setItemStatus('perk', 'future', 'wanted'));
  const serverEntry = { itemType: 'perk' as const, itemId: 'future', status: 'wanted' as const, updatedAt: 1_000_000 };
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.putMyItems).mockResolvedValue([serverEntry]);
  await act(async () => { await state.login('1@test.com', 'x'); });
  expect(state.items.get('perk:future')?.updatedAt).toBe(serverEntry.updatedAt);
  expect(JSON.parse(window.localStorage.getItem('mangoshare_my_items_v1:1')!)[0].updatedAt).toBe(serverEntry.updatedAt);
  vi.mocked(api.fetchMyItems).mockResolvedValue([serverEntry]);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(api.putMyItems).toHaveBeenCalledTimes(1);
});

it('persists a clamped tombstone and merges unrelated server items', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  vi.mocked(api.putMyItems).mockResolvedValue([
    { itemType: 'perk', itemId: 'deleted', status: '', updatedAt: 1_000_000 },
    { itemType: 'perk', itemId: 'remote', status: 'wanted', updatedAt: 999_999 },
  ]);
  await act(async () => state.setItemStatus('perk', 'deleted', null));
  expect(state.getItemStatus('perk', 'deleted')).toBeNull();
  expect(state.getItemStatus('perk', 'remote')).toBe('wanted');
  const stored = JSON.parse(window.localStorage.getItem('mangoshare_my_items_v1:1')!);
  expect(stored.find((entry: { itemId: string }) => entry.itemId === 'deleted')).toMatchObject({ status: '', updatedAt: 1_000_000 });
});

it('adopts a clamped single-item response without losing edits made during the request', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  const first = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  const second = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  vi.mocked(api.putMyItems).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await act(async () => state.setItemStatus('perk', 'future', 'wanted'));
  await act(async () => state.setItemStatus('perk', 'future', 'opened'));
  await act(async () => { first.resolve([{ itemType: 'perk', itemId: 'future', status: 'wanted', updatedAt: 1_000_000 }]); await first.promise; });
  expect(state.getItemStatus('perk', 'future')).toBe('opened');
  expect(state.items.get('perk:future')?.updatedAt).toBe(2_000_001);
  await act(async () => { second.resolve([{ itemType: 'perk', itemId: 'future', status: 'opened', updatedAt: 1_000_001 }]); await second.promise; });
  expect(state.items.get('perk:future')?.updatedAt).toBe(1_000_001);
});

it('ignores an older response arriving after a newer edit was acknowledged', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  const first = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  const second = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  vi.mocked(api.putMyItems).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await act(async () => state.setItemStatus('perk', 'race', 'wanted'));
  await act(async () => state.setItemStatus('perk', 'race', 'opened'));
  await act(async () => { second.resolve([{ itemType: 'perk', itemId: 'race', status: 'opened', updatedAt: 1_000_001 }]); await second.promise; });
  await act(async () => { first.resolve([{ itemType: 'perk', itemId: 'race', status: 'wanted', updatedAt: 1_000_000 }]); await first.promise; });
  expect(state.items.get('perk:race')).toMatchObject({ status: 'opened', updatedAt: 1_000_001 });
});

it('preserves a newer edit during a backlog upload and accepts its later acknowledgement', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(2_000_000);
  await act(async () => state.setItemStatus('perk', 'batch', 'wanted'));
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  const batch = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  const edit = deferred<Awaited<ReturnType<typeof api.putMyItems>>>();
  vi.mocked(api.putMyItems).mockReturnValueOnce(batch.promise).mockReturnValueOnce(edit.promise);
  let login!: Promise<unknown>;
  await act(async () => { login = state.login('1@test.com', 'x'); });
  await act(async () => state.setItemStatus('perk', 'batch', 'opened'));
  await act(async () => { batch.resolve([{ itemType: 'perk', itemId: 'batch', status: 'wanted', updatedAt: 1_000_000 }]); await login; });
  expect(state.getItemStatus('perk', 'batch')).toBe('opened');
  await act(async () => { edit.resolve([{ itemType: 'perk', itemId: 'batch', status: 'opened', updatedAt: 1_000_001 }]); await edit.promise; });
  expect(state.items.get('perk:batch')?.updatedAt).toBe(1_000_001);
});

it('keeps changes made while the login checklist fetch is pending', async () => {
  const pending = deferred<Awaited<ReturnType<typeof api.fetchMyItems>>>();
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.fetchMyItems).mockReturnValue(pending.promise);
  let login!: Promise<unknown>;
  await act(async () => { login = state.login('1@test.com', 'x'); });
  await act(async () => state.setItemStatus('perk', 'new', 'wanted'));
  await act(async () => { pending.resolve([]); await login; });
  expect(state.getItemStatus('perk', 'new')).toBe('wanted');
  expect(window.localStorage.getItem('mangoshare_my_items_v1:1')).toContain('new');
});

it('does not allow an older login response or logout response to replace a newer account', async () => {
  const old = deferred<Awaited<ReturnType<typeof api.loginAccount>>>();
  vi.mocked(api.loginAccount).mockReturnValueOnce(old.promise).mockResolvedValueOnce({ token: 'two', user: user(2) });
  let first!: Promise<unknown>;
  await act(async () => { first = state.login('1@test.com', 'x'); });
  await act(async () => { await state.login('2@test.com', 'x'); });
  await act(async () => { old.resolve({ token: 'one', user: user(1) }); await first; });
  expect(state.user?.id).toBe(2);
  const logout = deferred<void>(); vi.mocked(api.logoutAccount).mockReturnValue(logout.promise);
  let pending!: Promise<void>;
  await act(async () => { pending = state.logout(); });
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  await act(async () => { logout.resolve(); await pending; });
  expect(state.user?.id).toBe(1);
});

it('preserves failed sync locally and retries on reconnect', async () => {
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.putMyItems).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await state.login('1@test.com', 'x'); });
  await act(async () => state.setItemStatus('perk', 'offline', 'wanted'));
  expect(window.localStorage.getItem('mangoshare_my_items_v1:1')).toContain('offline');
  await act(async () => { window.dispatchEvent(new Event('online')); });
  const calls = vi.mocked(api.putMyItems).mock.calls;
  expect(calls[calls.length - 1]?.[1][0].itemId).toBe('offline');
});

 it('retains guest data when account-scoped persistence fails', async () => {
  await act(async () => state.setItemStatus('perk', 'guest', 'wanted'));
  const storage = window.localStorage;
  const original = storage.setItem;
  storage.setItem = (key: string, value: string) => { if (key.endsWith(':1')) throw new Error('quota'); original(key, value); };
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.fetchMyItems).mockRejectedValue(new Error('offline'));
  await act(async () => { await state.login('1@test.com', 'x'); });
  expect(storage.getItem('mangoshare_my_items_v1')).toContain('guest');
});

it('uploads a large backlog in bounded batches', async () => {
  await act(async () => { for (let i = 0; i < 2001; i++) state.setItemStatus('perk', String(i), 'wanted'); });
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  const batches = vi.mocked(api.putMyItems).mock.calls.map(call => call[1].length);
  expect(batches).toEqual([2000, 1]);
});

it('retains guest data when session persistence fails', async () => {
  await act(async () => state.setItemStatus('perk', 'guest-session', 'wanted'));
  const storage = window.localStorage; const original = storage.setItem;
  storage.setItem = (key: string, value: string) => { if (key === 'mangoshare_user_session') throw new Error('quota'); original(key, value); };
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.fetchMyItems).mockRejectedValue(new Error('offline'));
  await act(async () => { await state.login('1@test.com', 'x'); });
  expect(storage.getItem('mangoshare_my_items_v1')).toContain('guest-session');
});

it('does not overwrite preserved guest data on logout after persistence failure', async () => {
  await act(async () => state.setItemStatus('perk', 'recover', 'wanted'));
  const storage = window.localStorage; const original = storage.setItem;
  storage.setItem = (key: string, value: string) => { if (key.endsWith(':1')) throw new Error('quota'); original(key, value); };
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  vi.mocked(api.fetchMyItems).mockRejectedValue(new Error('offline'));
  await act(async () => { await state.login('1@test.com', 'x'); await state.logout(); });
  expect(storage.getItem('mangoshare_my_items_v1')).toContain('recover');
});

it('keeps each batch below the server body limit for escaped identifiers', async () => {
  await act(async () => { for (let i = 0; i < 1000; i++) state.setItemStatus('perk', String(i) + '\u0001'.repeat(120), 'wanted'); });
  vi.mocked(api.loginAccount).mockResolvedValue({ token: 'one', user: user(1) });
  await act(async () => { await state.login('1@test.com', 'x'); });
  for (const [, entries] of vi.mocked(api.putMyItems).mock.calls) {
    expect(new TextEncoder().encode(JSON.stringify({ items: entries })).length).toBeLessThanOrEqual(512 * 1024);
  }
});
