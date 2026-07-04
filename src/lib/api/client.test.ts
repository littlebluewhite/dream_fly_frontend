import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, ApiError, refreshTokens } from './client';
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

beforeEach(() => {
  clearTokens();
  localStorage.clear();
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

  it('returns false and clears tokens on a network error', async () => {
    setTokens('access', 'refresh');
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const ok = await refreshTokens();

    expect(ok).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
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

  it('in-lock re-read: a token already rotated by another tab is accepted without a second fetch', async () => {
    setTokens('expired-access', 'refresh-original');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', {
      locks: {
        request: vi.fn(async (_name: string, callback: () => Promise<boolean>) => {
          // Simulate another tab completing its own refresh while this tab waited for the lock.
          setTokens('leader-access', 'refresh-rotated-by-leader');
          return callback();
        })
      }
    });

    const ok = await refreshTokens();

    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getRefresh()).toBe('refresh-rotated-by-leader');
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

  it('two tabs racing a refresh: exactly one POST /auth/refresh; the follower detects the rotation and also resolves true', async () => {
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

    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ access_token: 'leader-access', refresh_token: 'refresh-rotated' }));
    vi.stubGlobal('fetch', fetchMock);

    // Two separate module instances stand in for two separate browser tabs: each
    // gets its own top-level `inFlightRefresh` closure, but both share the same
    // real localStorage and the same (stubbed) browser-wide navigator.locks.
    vi.resetModules();
    const tabA = await import('./client');
    vi.resetModules();
    const tabB = await import('./client');

    const [resultA, resultB] = await Promise.all([tabA.refreshTokens(), tabB.refreshTokens()]);

    expect(resultA).toBe(true);
    expect(resultB).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe('dreamfly-refresh');
  });
});
