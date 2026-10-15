import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { loginState, startSession, endSession, refreshFor, currentIdentity } from './login-state';
import { getAccess, getRefresh } from '$lib/api/tokens';
import type { AuthUserResponse } from '$lib/api/generated';

// Matches VITE_API_BASE_URL in .env / the spec's documented fallback, so
// assertions are valid whether or not Vite loaded the .env file for the test run.
const BASE = 'http://localhost:3000/api/v1';

const LOGGED_OUT = { loggedIn: false, member: null, roles: [] as string[] };

const USER_A: AuthUserResponse = {
  id: 'uuid-A',
  email: 'a@test.com',
  name: 'A',
  phone: null,
  phone_verified: false,
  avatar_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  roles: ['member']
};
const USER_B: AuthUserResponse = { ...USER_A, id: 'uuid-B', email: 'b@test.com', name: 'B' };

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

/** /auth/refresh 的成功回應:後端連同 user 一起回(AuthResponse)。 */
function rotated(access_token: string, refresh_token: string, user: AuthUserResponse = USER_A) {
  return { access_token, refresh_token, user };
}

/** 本分頁以 A 登入、手上是這組 token(同 authStore.login 成功後的狀態)。 */
function signedInAsA(access: string, refresh: string): void {
  startSession(rotated(access, refresh));
}

/** A minimal fake LockManager whose request() just awaits a tick and runs the
 *  callback — enough to exercise the "locks are available" branch without
 *  actually serializing anything. */
function passthroughLocks() {
  return { request: vi.fn((_name: string, callback: () => Promise<boolean>) => Promise.resolve().then(callback)) };
}

beforeEach(() => {
  endSession();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('refreshFor() — refresh single-flight', () => {
  it('POSTs the refresh token in the body (no Bearer header) and stores the rotated pair', async () => {
    signedInAsA('old-access', 'old-refresh');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rotated('rotated-access', 'rotated-refresh')));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/refresh`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'old-refresh' });
    expect(getAccess()).toBe('rotated-access');
    expect(getRefresh()).toBe('rotated-refresh');
  });

  it('returns false without calling fetch when there is no refresh token to send', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(null);

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccess()).toBeNull();
  });

  it('network error: returns false but keeps the tokens and stays logged in (refresh unavailable, not rejected)', async () => {
    signedInAsA('access', 'refresh');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(currentIdentity()).toBe(USER_A.id);
  });

  it('5xx: returns false but keeps the tokens and stays logged in', async () => {
    signedInAsA('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable')));

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(currentIdentity()).toBe(USER_A.id);
  });

  it.each([
    [408, 'Request Timeout'],
    [429, 'Too Many Requests']
  ])('%i (throttled/timed out, not a token verdict): returns false but keeps the tokens and stays logged in', async (status, statusText) => {
    signedInAsA('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'try later' }, status, statusText)));

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(currentIdentity()).toBe(USER_A.id);
  });

  it('401 (backend rejected the token): clears the tokens and goes LOGGED_OUT', async () => {
    signedInAsA('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized')));

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(get(loginState)).toEqual(LOGGED_OUT);
  });

  it('resolves false (never rejects) when the refresh-token storage read throws', async () => {
    signedInAsA('access', 'refresh'); // seed memory + storage before breaking reads
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: access to localStorage is denied');
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshFor(USER_A.id)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('refreshFor() cross-tab exclusivity (Web Locks)', () => {
  it('falls back to the current direct-refresh behavior when navigator.locks is unavailable', async () => {
    signedInAsA('expired-access', 'refresh-good');
    vi.stubGlobal('navigator', {}); // no .locks — older browsers, and jsdom's default in this test env
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rotated('new-access', 'new-refresh')));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
  });

  it('with locks available but no contention, a genuinely expired token still refreshes normally', async () => {
    signedInAsA('expired-access', 'refresh-good');
    vi.stubGlobal('navigator', { locks: passthroughLocks() });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rotated('new-access', 'new-refresh')));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
  });

  it('in-lock re-read: a follower whose token was rotated by another tab while it waited exchanges the current token for its own access', async () => {
    signedInAsA('expired-access', 'refresh-original');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rotated('follower-access', 'refresh-rotated-again')));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn(async (_name: string, callback: () => Promise<boolean>) => {
          // Simulate another tab completing its own refresh while this tab waited for the lock.
          // That tab's new access token lives only in *its* memory, so this tab must not reuse it.
          localStorage.setItem('dreamfly_refresh', 'refresh-rotated-by-leader');
          return callback();
        })
      }
    });

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      refresh_token: 'refresh-rotated-by-leader'
    });
    expect(getAccess()).toBe('follower-access');
    expect(getRefresh()).toBe('refresh-rotated-again');
  });

  it('a genuine refresh failure inside the lock still clears tokens and returns false', async () => {
    signedInAsA('expired-access', 'refresh-bad');
    vi.stubGlobal('navigator', { locks: passthroughLocks() });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it('two tabs racing a refresh: the POSTs run in sequence, no refresh token is sent twice, and both tabs end with an access token', async () => {
    // A minimal fake LockManager that actually serializes callers, like a real mutex:
    // the second request()'s callback only starts once the first one's has settled.
    let queue: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_name: string, callback: () => Promise<boolean>) => {
      const turn = queue.then(() => callback());
      queue = turn.catch(() => undefined);
      return turn;
    });
    vi.stubGlobal('navigator', { locks: { request } });

    // Fake backend with rotation + reuse detection: each refresh token is accepted once.
    const spent = new Set<string>();
    let issued = 0;
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const { refresh_token } = JSON.parse(init.body as string) as { refresh_token: string };
      if (spent.has(refresh_token)) {
        return jsonResponse({ error: 'refresh token reused' }, 401, 'Unauthorized');
      }
      spent.add(refresh_token);
      issued += 1;
      return jsonResponse(rotated(`access-${issued}`, `refresh-${issued}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    // Two separate module instances stand in for two separate browser tabs: each
    // gets its own top-level `inFlightRefresh` closure and its own in-memory access
    // token, but both share the same real localStorage and the same (stubbed)
    // browser-wide navigator.locks. Both tabs are logged in as A on the shared refresh token.
    vi.resetModules();
    const tabA = await import('./login-state');
    const tokensA = await import('$lib/api/tokens');
    vi.resetModules();
    const tabB = await import('./login-state');
    const tokensB = await import('$lib/api/tokens');
    tabA.startSession(rotated('expired-access', 'refresh-shared'));
    tabB.startSession(rotated('expired-access', 'refresh-shared'));

    const [resultA, resultB] = await Promise.all([tabA.refreshFor(USER_A.id), tabB.refreshFor(USER_A.id)]);

    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('dreamfly-refresh');
    const sent = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(init.body as string) as { refresh_token: string }).refresh_token
    );
    expect(sent).toEqual(['refresh-shared', 'refresh-1']);
    expect(tokensA.getAccess()).toBe('access-1');
    expect(tokensB.getAccess()).toBe('access-2');
    expect(getRefresh()).toBe('refresh-2');
  });

  it('a refresh token replaced while the failing POST was in flight is not cleared', async () => {
    signedInAsA('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {}); // compare-and-clear holds with or without Web Locks
    const fetchMock = vi.fn(async () => {
      // Another tab (no shared lock) or a fresh login stores a new token mid-flight.
      localStorage.setItem('dreamfly_refresh', 'refresh-fresh');
      return jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized');
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRefresh()).toBe('refresh-fresh');
    expect(getAccess()).toBe('expired-access');
    expect(currentIdentity()).toBe(USER_A.id);
  });

  it('another tab logged out while the failing POST was in flight: clears this tab too and goes LOGGED_OUT', async () => {
    signedInAsA('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {});
    const fetchMock = vi.fn(async () => {
      localStorage.removeItem('dreamfly_refresh'); // the other tab's logout
      return jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized');
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(get(loginState)).toEqual(LOGGED_OUT);
  });

  it('a fresh login stored while a successful POST was in flight wins: the stale rotated pair is dropped', async () => {
    signedInAsA('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {});
    const fetchMock = vi.fn(async () => {
      startSession(rotated('login-access', 'refresh-login', USER_B)); // a new login lands mid-flight
      return jsonResponse(rotated('stale-access', 'stale-refresh'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshFor(USER_A.id);

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRefresh()).toBe('refresh-login');
    expect(getAccess()).toBe('login-access');
    expect(currentIdentity()).toBe(USER_B.id);
  });
});

// R18 W1:憑證與畫面身分同一拍換主(核心內部同拍,不再經 callback)。
describe('refreshFor() — 只有 compare-and-set 成功才換身分', () => {
  it('換成後端回的 user;CAS 失敗、拒絕、不可用都不換成那位', async () => {
    signedInAsA('old-access', 'old-refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(rotated('a2', 'r2', USER_B))));
    expect(await refreshFor(USER_A.id)).toBe(false); // token 換成 B 的了:不替 A 重送
    expect(currentIdentity()).toBe(USER_B.id);
    expect(get(loginState).member?.name).toBe('B');
    expect(getAccess()).toBe('a2');

    signedInAsA('old-access', 'old-refresh');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        startSession(rotated('login-access', 'refresh-login')); // 在飛期間換上新登入:輪替結果被丟棄
        return jsonResponse(rotated('stale', 'stale-r', USER_B));
      })
    );
    expect(await refreshFor(USER_A.id)).toBe(false);
    expect(currentIdentity()).toBe(USER_A.id);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid' }, 401, 'Unauthorized')));
    expect(await refreshFor(USER_A.id)).toBe(false); // 拒絕
    expect(get(loginState)).toEqual(LOGGED_OUT);

    signedInAsA('a', 'r');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'down' }, 503, 'Service Unavailable')));
    expect(await refreshFor(USER_A.id)).toBe(false); // 不可用
    expect(currentIdentity()).toBe(USER_A.id);
  });
});
