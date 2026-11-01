/**
 * Tests for the account backend client: request error mapping (network vs
 * HTTP vs non-JSON), auth helpers, the tri-state session verification, and
 * the checklist sync endpoints. fetch is stubbed like admin-auth.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountApiError,
  fetchMyItems,
  loginAccount,
  logoutAccount,
  putMyItems,
  registerAccount,
  sendVerificationCode,
  verifyAccountSession,
} from './account-api';

const TOKEN = 'tok-1';
const USER = { id: 1, email: 'a@b.c', displayName: 'A', createdAt: 1735689600, role: 'user' };

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth endpoints', () => {
  it('sendVerificationCode posts email + purpose', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await sendVerificationCode('a@b.c', 'register');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/account-api/api/auth/send-code');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.c', purpose: 'register' });
  });

  it('registerAccount returns the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ token: TOKEN, user: USER })));

    const session = await registerAccount('a@b.c', '123456', 'password123', 'A');
    expect(session).toEqual({ token: TOKEN, user: USER });
  });

  it('auth responses normalize a missing/garbage role to user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: TOKEN, user: { ...USER, role: undefined } }))
    );
    let session = await registerAccount('a@b.c', '123456', 'password123', 'A');
    expect(session.user.role).toBe('user');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ token: TOKEN, user: { ...USER, role: 'admin' } }))
    );
    session = await loginAccount('a@b.c', 'password123');
    expect(session.user.role).toBe('admin');
  });

  it('loginAccount returns the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: TOKEN, user: USER }));
    vi.stubGlobal('fetch', fetchMock);

    const session = await loginAccount('a@b.c', 'password123');
    expect(session.token).toBe(TOKEN);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('logoutAccount swallows network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    await expect(logoutAccount(TOKEN)).resolves.toBeUndefined();
  });
});

describe('error mapping', () => {
  it('propagates the server error message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: '验证码错误' }, 400)));

    const err = await loginAccount('a@b.c', 'bad').catch((e) => e);
    expect(err).toBeInstanceOf(AccountApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('验证码错误');
  });

  it('falls back to a generic message for non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('not json')),
    } as unknown as Response));

    const err = await loginAccount('a@b.c', 'x').catch((e) => e);
    expect(err).toBeInstanceOf(AccountApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe('服务暂时不可用，请稍后重试');
  });

  it('maps network failures to a network error with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    const err = await sendVerificationCode('a@b.c', 'reset').catch((e) => e);
    expect(err).toBeInstanceOf(AccountApiError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('网络异常，请检查网络后重试');
  });
});

describe('verifyAccountSession', () => {
  it.each([401, 403])('reports invalid on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, status)));
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'invalid', user: null });
  });

  it('reports unreachable on 5xx and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'unreachable', user: null });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'unreachable', user: null });
  });

  it('returns the refreshed profile on success, normalizing the role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ user: { ...USER, role: 'admin' } }))
    );
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'valid', user: { ...USER, role: 'admin' } });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ user: USER })));
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'valid', user: USER });

    // non-JSON 200 body still counts as valid, without a profile
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('not json')),
    } as unknown as Response));
    expect(await verifyAccountSession(TOKEN)).toEqual({ result: 'valid', user: null });
  });
});

describe('checklist sync', () => {
  it('fetchMyItems returns the items array and rejects malformed responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tombstoneProtocol: 1, items: [
      { itemType: 'u-card', itemId: 'a', status: 'opened', updatedAt: 1 },
    ] }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await fetchMyItems(TOKEN);
    expect(items).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/account-api/api/my/items?includeDeleted=1');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(fetchMyItems(TOKEN)).rejects.toBeInstanceOf(AccountApiError);
  });

  it('putMyItems PUTs the payload with the bearer token', async () => {
    const authoritative = [{ itemType: 'perk', itemId: 'p1', status: 'wanted', updatedAt: 5 }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tombstoneProtocol: 1, items: authoritative }));
    vi.stubGlobal('fetch', fetchMock);

    const items = await putMyItems(TOKEN, [
      { itemType: 'perk', itemId: 'p1', status: 'wanted', updatedAt: 5 },
    ]);
    expect(items).toEqual(authoritative);
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe('PUT');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body).items[0].status).toBe('wanted');
  });
});

it('refuses an old server without tombstone capability before writing', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchMyItems(TOKEN)).rejects.toBeInstanceOf(AccountApiError);
  await expect(putMyItems(TOKEN, [{ itemType: 'perk', itemId: 'x', status: '', updatedAt: 1 }])).rejects.toBeInstanceOf(AccountApiError);
  expect(fetchMock.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true);
});
