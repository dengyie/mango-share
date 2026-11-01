/**
 * useUserAccount — App-level user session + checklist state.
 *
 * Owns:
 * - the account session (localStorage, verified once at startup against
 *   /account-api/api/me — only an explicit server rejection clears it,
 *   a flaky network must not log users out);
 * - the per-item opened/wanted checklist. Guests get a local map persisted
 *   to localStorage; logged-in users get server sync with last-writer-wins
 *   merge on login plus per-change pushes. A failed push leaves the local
 *   entry in place — the next successful sync reconciles it.
 *
 * Server responses are always merged into the latest local state, never
 * substituted for it: concurrent pushes can resolve out of order, and a
 * wholesale replace would visibly drop marks made after the request left.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AccountSession, AccountUser, MyItemStatus, MyItemType } from '../types/account';
import {
  AccountApiError,
  fetchMyItems,
  loginAccount,
  logoutAccount,
  normalizeUser,
  putMyItems,
  registerAccount,
  resetPassword,
  sendVerificationCode,
  verifyAccountSession,
} from '../utils/account-api';
import {
  clearLocalItems,
  diffForUpload,
  itemKey,
  loadLocalItems,
  mergeItems,
  saveLocalItems,
  upsertItem,
  type MyItemsMap,
  type SyncItemEntry,
} from '../utils/my-items';

// A PUT response is authoritative for the exact versions it sent, including
// timestamps clamped by the server. Never replace an edit made in flight.
function mergePutResponse(local: MyItemsMap, sent: SyncItemEntry[], server: SyncItemEntry[]): MyItemsMap {
  const sentByKey = new Map(sent.map(entry => [itemKey(entry.itemType, entry.itemId), entry]));
  const other = server.filter(entry => !sentByKey.has(itemKey(entry.itemType, entry.itemId)));
  const merged = mergeItems(local, other);
  for (const entry of server) {
    const key = itemKey(entry.itemType, entry.itemId);
    const original = sentByKey.get(key);
    if (original && local.get(key) === original) merged.set(key, entry);
  }
  return merged;
}

const USER_SESSION_STORAGE_KEY = 'mangoshare_user_session';

function loadStoredSession(): AccountSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AccountSession;
    if (!session || typeof session.token !== 'string' || !session.user || typeof session.user.email !== 'string') {
      return null;
    }
    // Sessions saved before the role field existed must not read as admin.
    return { ...session, user: normalizeUser(session.user) };
  } catch {
    return null;
  }
}

function saveStoredSession(session: AccountSession | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (session) {
      window.localStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(USER_SESSION_STORAGE_KEY);
    }
    return true;
  } catch (e) {
    console.warn('Failed to persist user session:', e);
    return false;
  }
}

export interface UserAccountState {
  /** null = guest */
  user: AccountUser | null;
  /** false until the startup session verification has settled */
  sessionReady: boolean;
  items: Map<string, import('../types/account').MyItemEntry>;
  counts: { opened: number; wanted: number };
  getItemStatus: (itemType: MyItemType, itemId: string) => MyItemStatus | null;
  /** Mark/unmark an item; guests stay local, users sync to the server. */
  setItemStatus: (itemType: MyItemType, itemId: string, status: MyItemStatus | null) => void;
  /** Authenticates and merges the guest checklist into the server list. */
  login: (email: string, password: string) => Promise<AccountUser>;
  register: (email: string, code: string, password: string, displayName: string) => Promise<AccountUser>;
  resetPassword: (email: string, code: string, password: string) => Promise<AccountUser>;
  logout: () => Promise<void>;
  sendCode: (email: string, purpose: 'register' | 'reset') => Promise<void>;
}

const UserAccountContext = createContext<UserAccountState | null>(null);

export function useUserAccount(): UserAccountState {
  const ctx = useContext(UserAccountContext);
  if (!ctx) {
    throw new Error('useUserAccount must be used within <UserAccountProvider>');
  }
  return ctx;
}

export function accountApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AccountApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function UserAccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(() => loadStoredSession());
  const [sessionReady, setSessionReady] = useState(false);
  const [items, setItems] = useState<MyItemsMap>(() => session
    ? mergeItems(loadLocalItems(String(session.user.id)), Array.from(loadLocalItems().values()))
    : loadLocalItems());
  const sessionRef = useRef(session);
  const itemsRef = useRef(items);
  const authGeneration = useRef(0);

  const updateItems = useCallback((next: MyItemsMap, scope?: string) => {
    itemsRef.current = next;
    setItems(next);
    return saveLocalItems(next, scope);
  }, []);

  const applySession = useCallback((next: AccountSession | null) => {
    setSession(next);
    const persisted = saveStoredSession(next);
    sessionRef.current = next;
    return persisted;
  }, []);

  const sync = useCallback(async (current: AccountSession) => {
    const token = current.token;
    const scope = String(current.user.id);
    const server = await fetchMyItems(token);
    if (sessionRef.current?.token !== token) return;
    const merged = mergeItems(itemsRef.current, server);
    updateItems(merged, scope);
    const upload = diffForUpload(merged, server);
    // Upload deletions first so they can free capacity for new marks.
    upload.sort((a, b) => Number(a.status !== '') - Number(b.status !== ''));
    const encoder = new TextEncoder();
    let offset = 0;
    while (offset < upload.length) {
      const batch: typeof upload = [];
      let bytes = 11; // {"items":[]} and a small margin
      while (offset < upload.length && batch.length < 2000) {
        const size = encoder.encode(JSON.stringify(upload[offset])).length + 1;
        if (bytes + size > 512 * 1024) {
          if (!batch.length) throw new Error('同步条目过大');
          break;
        }
        bytes += size;
        batch.push(upload[offset++]);
      }
      if (sessionRef.current?.token !== token) return;
      const authoritative = await putMyItems(token, batch);
      if (sessionRef.current?.token !== token) return;
      updateItems(mergePutResponse(itemsRef.current, batch, authoritative), scope);
    }
  }, [updateItems]);

  useEffect(() => {
    let cancelled = false;
    const stored = sessionRef.current;
    const generation = authGeneration.current;
    if (!stored) { setSessionReady(true); return; }
    (async () => {
      const outcome = await verifyAccountSession(stored.token);
      if (cancelled || generation !== authGeneration.current || sessionRef.current?.token !== stored.token) return;
      if (outcome.result === 'invalid') {
        applySession(null);
        updateItems(loadLocalItems());
      } else if (outcome.result === 'valid') {
        if (outcome.user) applySession({ token: stored.token, user: outcome.user });
        try { await sync(stored); } catch { /* retained for retry */ }
      }
      if (!cancelled) setSessionReady(true);
    })();
    return () => { cancelled = true; };
  }, [applySession, sync, updateItems]);

  useEffect(() => {
    const retry = () => {
      const current = sessionRef.current;
      if (current) void sync(current).catch(() => {});
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sync]);

  const setItemStatus = useCallback(
    (itemType: MyItemType, itemId: string, status: MyItemStatus | null) => {
      // All state work happens in the event handler (run once), never in a
      // setState updater — updaters must stay pure and can be re-invoked.
      const next = upsertItem(itemsRef.current, itemType, itemId, status);
      const current = sessionRef.current;
      updateItems(next, current ? String(current.user.id) : undefined);
      if (current) {
        const token = current.token;
        const entry = next.get(itemKey(itemType, itemId))!;
        // Fire-and-forget single-entry push; on failure the local state
        // already reflects the change and the next full sync reconciles.
        putMyItems(token, [entry])
          .then((authoritative) => {
            // The session may have logged out (or switched accounts) while
            // the push was in flight — never merge into the wrong session.
            if (sessionRef.current?.token !== token) return;
            updateItems(mergePutResponse(itemsRef.current, [entry], authoritative), String(current.user.id));
          })
          .catch(() => {
            /* offline — reconciled on next sync */
          });
      }
    },
    [updateItems]
  );

  /** Shared tail of login/register/reset: adopt session, merge checklist. */
  const adoptAuthSession = useCallback(
    async (next: AccountSession, generation: number) => {
      if (generation !== authGeneration.current) return next.user;
      const guest = sessionRef.current ? new Map() : itemsRef.current;
      const local = mergeItems(loadLocalItems(String(next.user.id)), Array.from(guest.values()));
      const sessionSaved = applySession(next);
      const itemsSaved = updateItems(local, String(next.user.id));
      if (sessionSaved && itemsSaved) clearLocalItems();
      setSessionReady(true);
      try { await sync(next); } catch (err) {
        console.warn('checklist merge after login failed:', err);
      }
      return next.user;
    },
    [applySession, sync, updateItems]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const generation = ++authGeneration.current;
      return adoptAuthSession(await loginAccount(email, password), generation);
    },
    [adoptAuthSession]
  );

  const register = useCallback(
    async (email: string, code: string, password: string, displayName: string) => {
      const generation = ++authGeneration.current;
      return adoptAuthSession(await registerAccount(email, code, password, displayName), generation);
    },
    [adoptAuthSession]
  );

  const resetPasswordAndLogin = useCallback(
    async (email: string, code: string, password: string) => {
      const generation = ++authGeneration.current;
      return adoptAuthSession(await resetPassword(email, code, password), generation);
    },
    [adoptAuthSession]
  );

  const logout = useCallback(async () => {
    ++authGeneration.current;
    const current = sessionRef.current;
    applySession(null);
    updateItems(loadLocalItems());
    setSessionReady(true);
    if (current) await logoutAccount(current.token);
  }, [applySession, updateItems]);

  const sendCode = useCallback(async (email: string, purpose: 'register' | 'reset') => {
    await sendVerificationCode(email, purpose);
  }, []);

  const getItemStatus = useCallback(
    (itemType: MyItemType, itemId: string): MyItemStatus | null =>
      items.get(`${itemType}:${itemId}`)?.status || null,
    [items]
  );

  const counts = useMemo(() => {
    let opened = 0;
    let wanted = 0;
    for (const entry of items.values()) {
      if (entry.status === 'opened') opened++;
      else if (entry.status === 'wanted') wanted++;
    }
    return { opened, wanted };
  }, [items]);

  const visibleItems = useMemo(() => new Map(Array.from(items).filter(([, entry]) => entry.status !== '')) as Map<string, import('../types/account').MyItemEntry>, [items]);

  const value = useMemo<UserAccountState>(
    () => ({
      user: session?.user ?? null,
      sessionReady,
      items: visibleItems,
      counts,
      getItemStatus,
      setItemStatus,
      login,
      register,
      resetPassword: resetPasswordAndLogin,
      logout,
      sendCode,
    }),
    [session, sessionReady, visibleItems, counts, getItemStatus, setItemStatus, login, register, resetPasswordAndLogin, logout, sendCode]
  );

  return <UserAccountContext.Provider value={value}>{children}</UserAccountContext.Provider>;
}
