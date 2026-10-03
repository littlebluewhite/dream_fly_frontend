import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, ApiError, refreshTokens, onSessionExpired } from './client';
import { getAccess, getRefresh, setTokens, clearTokens } from './tokens';

// Matches VITE_API_BASE_URL in .env / the spec's documented fallback, so
// assertions are valid whether or not Vite loaded the .env file for the test run.
const BASE = 'http://localhost:3000/api/v1';

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
    statusText: 'No Content',
    json: async () => {
      throw new Error('body should never be read on a 204 response');
    }
  };
}

/** A minimal fake LockManager whose request() just awaits a tick and runs the
 *  callback — enough to exercise the "locks are available" branch without
 *  actually serializing anything. */
function passthroughLocks() {
  return { request: vi.fn((_name: string, callback: () => Promise<boolean>) => Promise.resolve().then(callback)) };
}

// The session-expired signal fires only at performRefresh's one clear point.
const expired = vi.fn();
onSessionExpired(expired);

beforeEach(() => {
  clearTokens();
  localStorage.clear();
  expired.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api()', () => {
  it('prefixes the base URL and sends no Authorization header when there is no access token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'healthy' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api<{ status: string }>('/health', { auth: false });

    expect(result).toEqual({ status: 'healthy' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/health`);
    expect((init.headers as Headers).has('Authorization')).toBe(false);
  });

  it('attaches Authorization: Bearer <access token> when a token is set and auth !== false', async () => {
    setTokens('access-abc', 'refresh-abc');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'me' }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/users/me');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer access-abc');
  });

  it('defaults Content-Type: application/json when a body is present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'inq-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/contact', {
      method: 'POST',
      body: JSON.stringify({ name: 'a' }),
      auth: false
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('maps a non-2xx {"error": "..."} response to an ApiError carrying that status and message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid coupon' }, 400, 'Bad Request'));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/orders', { method: 'POST', auth: false }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('invalid coupon');
  });

  it('falls back to a generic (status text) message when the error body is not valid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      }
    });
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/whatever', { auth: false }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Internal Server Error');
  });

  it('falls back to a generic message when the error body is valid JSON but has no "error" field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'nope' }, 422, 'Unprocessable Entity'));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/whatever', { auth: false }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe('Unprocessable Entity');
  });

  it('returns undefined for a 204 No Content response without reading the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(noContentResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await api('/cart', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('on 401, refreshes the token pair then retries the original request once and succeeds', async () => {
    setTokens('expired-access', 'refresh-good');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')); // 1. original request
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' })
    ); // 2. refresh
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'abc' })); // 3. retried original request
    vi.stubGlobal('fetch', fetchMock);

    const result = await api<{ id: string }>('/users/me');

    expect(result).toEqual({ id: 'abc' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/users/me`);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/auth/refresh`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${BASE}/users/me`);
    // the retry carries the NEW access token, proving setTokens() ran before the retry
    expect((fetchMock.mock.calls[2][1].headers as Headers).get('Authorization')).toBe('Bearer new-access');
    // the refresh call itself carries no Authorization header (it authenticates via body)
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('single-flight: two concurrent 401s trigger exactly one /auth/refresh call', async () => {
    setTokens('expired-access', 'refresh-good');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401, 'Unauthorized')); // request A
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401, 'Unauthorized')); // request B
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' })
    ); // the ONE shared refresh
    fetchMock.mockResolvedValueOnce(jsonResponse({ tag: 'A' })); // retry A
    fetchMock.mockResolvedValueOnce(jsonResponse({ tag: 'B' })); // retry B
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([api<{ tag: string }>('/a'), api<{ tag: string }>('/b')]);

    expect(a).toEqual({ tag: 'A' });
    expect(b).toEqual({ tag: 'B' });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === `${BASE}/auth/refresh`);
    expect(refreshCalls).toHaveLength(1);
    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
  });

  it('refresh failure clears tokens (no localStorage residue) and api() throws ApiError(401)', async () => {
    setTokens('expired-access', 'refresh-bad');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')); // original
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized')); // refresh fails
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/users/me').catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no third retry attempt after a failed refresh
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(localStorage.getItem('dreamfly_refresh')).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('a request made with auth: false never attempts a refresh, even on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad credentials' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/auth/login', { method: 'POST', auth: false }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never touched /auth/refresh
  });

  it('on a 401, throws ApiError(401) — not a raw storage error — when the refresh-token read throws (SecurityError)', async () => {
    // Reproduces the concrete failure path: performRefresh() reads the refresh
    // token via getRefresh(); if that access throws (privacy-hardened browser /
    // sandboxed iframe), the exception must be absorbed into refreshTokens()
    // returning false, so api() still surfaces the specified ApiError(401).
    setTokens('expired-access', 'refresh-good'); // writes memory + localStorage before we break reads
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: access to localStorage is denied');
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/users/me').catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    // original request only; the refresh short-circuits on the read failure without a network call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('refreshTokens()', () => {
  it('POSTs the refresh token in the body (no Bearer header) and stores the rotated pair', async () => {
    setTokens('old-access', 'old-refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'rotated-access', refresh_token: 'rotated-refresh' }));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

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

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccess()).toBeNull();
  });

  it('network error: returns false but keeps the tokens and does not signal expiry (refresh unavailable, not rejected)', async () => {
    setTokens('access', 'refresh');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(expired).not.toHaveBeenCalled();
  });

  it('5xx: returns false but keeps the tokens and does not signal expiry', async () => {
    setTokens('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable')));

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([
    [408, 'Request Timeout'],
    [429, 'Too Many Requests']
  ])('%i (throttled/timed out, not a token verdict): returns false but keeps the tokens and does not signal expiry', async (status, statusText) => {
    setTokens('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'try later' }, status, statusText)));

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(getAccess()).toBe('access');
    expect(getRefresh()).toBe('refresh');
    expect(expired).not.toHaveBeenCalled();
  });

  it('401 (backend rejected the token): clears the tokens and signals expiry once', async () => {
    setTokens('access', 'refresh');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized')));

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('resolves false (never rejects) when the refresh-token storage read throws', async () => {
    setTokens('access', 'refresh'); // seed memory + storage before breaking reads
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: access to localStorage is denied');
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshTokens()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('refreshTokens() cross-tab exclusivity (Web Locks)', () => {
  it('falls back to the current direct-refresh behavior when navigator.locks is unavailable', async () => {
    setTokens('expired-access', 'refresh-good');
    vi.stubGlobal('navigator', {}); // no .locks — older browsers, and jsdom's default in this test env
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' }));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
  });

  it('with locks available but no contention, a genuinely expired token still refreshes normally', async () => {
    setTokens('expired-access', 'refresh-good');
    vi.stubGlobal('navigator', { locks: passthroughLocks() });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' }));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
  });

  it('in-lock re-read: a follower whose token was rotated by another tab while it waited exchanges the current token for its own access', async () => {
    setTokens('expired-access', 'refresh-original');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'follower-access', refresh_token: 'refresh-rotated-again' }));
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

    const ok = await refreshTokens();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      refresh_token: 'refresh-rotated-by-leader'
    });
    expect(getAccess()).toBe('follower-access');
    expect(getRefresh()).toBe('refresh-rotated-again');
  });

  it('a genuine refresh failure inside the lock still clears tokens and returns false', async () => {
    setTokens('expired-access', 'refresh-bad');
    vi.stubGlobal('navigator', { locks: passthroughLocks() });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it('two tabs racing a refresh: the POSTs run in sequence, no refresh token is sent twice, and both tabs end with an access token', async () => {
    setTokens('expired-access', 'refresh-shared');

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
      return jsonResponse({ access_token: `access-${issued}`, refresh_token: `refresh-${issued}` });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Two separate module instances stand in for two separate browser tabs: each
    // gets its own top-level `inFlightRefresh` closure and its own in-memory access
    // token, but both share the same real localStorage and the same (stubbed)
    // browser-wide navigator.locks.
    vi.resetModules();
    const tabA = await import('./client');
    const tokensA = await import('./tokens');
    vi.resetModules();
    const tabB = await import('./client');
    const tokensB = await import('./tokens');

    const [resultA, resultB] = await Promise.all([tabA.refreshTokens(), tabB.refreshTokens()]);

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
    setTokens('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {}); // compare-and-clear holds with or without Web Locks
    const fetchMock = vi.fn(async () => {
      // Another tab (no shared lock) or a fresh login stores a new token mid-flight.
      localStorage.setItem('dreamfly_refresh', 'refresh-fresh');
      return jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized');
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRefresh()).toBe('refresh-fresh');
    expect(getAccess()).toBe('expired-access');
    expect(expired).not.toHaveBeenCalled();
  });

  it('another tab logged out while the failing POST was in flight: clears this tab too and signals expiry once', async () => {
    setTokens('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {});
    const fetchMock = vi.fn(async () => {
      localStorage.removeItem('dreamfly_refresh'); // the other tab's logout
      return jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized');
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('a fresh login stored while a successful POST was in flight wins: the stale rotated pair is dropped', async () => {
    setTokens('expired-access', 'refresh-stale');
    vi.stubGlobal('navigator', {});
    const fetchMock = vi.fn(async () => {
      setTokens('login-access', 'refresh-login'); // a new login lands mid-flight
      return jsonResponse({ access_token: 'stale-access', refresh_token: 'stale-refresh' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRefresh()).toBe('refresh-login');
    expect(getAccess()).toBe('login-access');
    expect(expired).not.toHaveBeenCalled();
  });
});
