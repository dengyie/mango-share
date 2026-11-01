import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '../utils/admin-auth';

const h = vi.hoisted(() => ({ states: [] as unknown[], refs: [] as Array<{current: unknown}>, si: 0, ri: 0, effects: [] as Array<() => void | (() => void)>, stored: null as AdminSession | null, resolve: null as null | ((value: 'valid' | 'invalid' | 'unreachable') => void) }));
vi.mock('react', () => ({
  useState: (init: unknown) => { const i = h.si++; if (!(i in h.states)) h.states[i] = typeof init === 'function' ? (init as () => unknown)() : init; return [h.states[i], (v: unknown) => { h.states[i] = v; }]; },
  useRef: (initial: unknown) => { const i = h.ri++; return h.refs[i] ||= {current: initial}; },
  useEffect: (fn: () => void | (() => void)) => { h.effects.push(fn); },
  useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
}));
vi.mock('../utils/admin-auth', async (original) => ({ ...(await original<typeof import('../utils/admin-auth')>()),
  loadAdminSession: () => h.stored,
  saveAdminSession: (s: AdminSession) => { h.stored = s; },
  clearAdminSession: () => { h.stored = null; },
  verifyAdminSession: () => new Promise(resolve => { h.resolve = resolve; }),
  logoutAdmin: vi.fn(),
}));
vi.mock('../utils/api-station-sync', async (original) => ({ ...(await original<typeof import('../utils/api-station-sync')>()), fetchApiStationConfig: () => new Promise(() => {}), fetchPublicStationChannels: () => new Promise(() => {}) }));
import { useAiHubData } from './useAiHubData';
const session = (token: string): AdminSession => ({baseUrl:'https://api.mangoqwq.com', username:token, displayName:token, role:10, token, expiresAt: Date.now()+60000});
function render() { h.si = 0; h.ri = 0; h.effects = []; return useAiHubData([]); }
beforeEach(() => { h.states = []; h.refs = []; h.stored = session('old'); h.resolve = null; });
describe('admin restore race', () => {
  it.each(['invalid', 'valid'] as const)('ignores stale %s verification after a new login', async result => {
    let hub = render(); h.effects[0]();
    hub.handleAdminLogin(session('new'));
    h.resolve!(result); await Promise.resolve();
    hub = render();
    expect(h.stored?.token).toBe('new');
    expect(hub.adminSession?.token).toBe('new');
    expect(hub.isAdmin).toBe(true);
  });
  it('ignores late verification after logout', async () => {
    let hub = render(); h.effects[0]();
    hub = render(); hub.handleAdminLogout();
    h.resolve!('valid'); await Promise.resolve();
    hub = render();
    expect(h.stored).toBeNull(); expect(hub.adminSession).toBeNull(); expect(hub.isAdmin).toBe(false);
  });
});
