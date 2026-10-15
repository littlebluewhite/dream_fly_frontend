import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from './client';
import { getAccess, getRefresh } from './tokens';
import { loginState, startSession, endSession } from '$lib/stores/login-state';
import type { AuthUserResponse } from './generated';
import { BASE, LOGGED_OUT, USER_A, USER_B, jsonResponse } from '$lib/testing/auth-fixtures';

/** 本分頁以 `user`(預設 A)登入、手上是這組 token——走登入狀態核心的真入口,不手寫假的 authStore。 */
function signedIn(access: string, refresh: string, user: AuthUserResponse = USER_A): void {
  startSession({ access_token: access, refresh_token: refresh, user });
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

beforeEach(() => {
  endSession();
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
    signedIn('access-abc', 'refresh-abc');
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
    signedIn('expired-access', 'refresh-good');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')); // 1. original request
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh', user: USER_A })
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
    signedIn('expired-access', 'refresh-good');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401, 'Unauthorized')); // request A
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401, 'Unauthorized')); // request B
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh', user: USER_A })
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
    signedIn('expired-access', 'refresh-bad');
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
    expect(get(loginState)).toEqual(LOGGED_OUT);
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
    // sandboxed iframe), the exception must be absorbed into refreshFor()
    // returning false, so api() still surfaces the specified ApiError(401).
    signedIn('expired-access', 'refresh-good'); // writes memory + localStorage before we break reads
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

// R18 W1:憑證與畫面身分同一拍換主;401 重送只替發出請求的那個身分。
describe('api() — 401 重送只替發出當下的身分', () => {
  it('refresh 換出 B 的憑證、請求是 A 發的 → ApiError(401),從不帶 Bearer aB 重送', async () => {
    signedIn('aA', 'rA');
    localStorage.setItem('dreamfly_refresh', 'rB'); // 別的分頁已換登成 B,本分頁還沒收到 storage 事件
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')); // A 的請求
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'aB', refresh_token: 'rB2', user: USER_B })); // refresh
    fetchMock.mockResolvedValue(jsonResponse({ id: 'written-as-B' }));
    vi.stubGlobal('fetch', fetchMock);

    const err = (await api('/users/me', { method: 'PATCH', body: '{}' }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bearers = fetchMock.mock.calls.map(([, init]) => (init.headers as Headers).get?.('Authorization'));
    expect(bearers).not.toContain('Bearer aB');
    expect(getAccess()).toBe('aB'); // 憑證仍照常輪替存好——只是不替 A 重送
  });

  it('401 落地前畫面身分已變 → 不 refresh、不重送,只有 1 次 fetch', async () => {
    signedIn('aA', 'rA');
    let release!: (r: unknown) => void;
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise((r) => (release = r)));
    vi.stubGlobal('fetch', fetchMock);

    const pending = api('/users/me', { method: 'PATCH', body: '{}' }).catch((e) => e);
    await vi.waitFor(() => expect(release).toBeDefined());
    signedIn('aB', 'rB', USER_B); // 例如本分頁換登成 B
    release(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized'));
    const err = (await pending) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
