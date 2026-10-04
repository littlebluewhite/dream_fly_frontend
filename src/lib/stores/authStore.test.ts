import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isLoggedIn, toMember, sessionIdentity, type ApiUser } from './authStore';
import type { AuthUserResponse } from '$lib/api/generated';
import { api, ApiError } from '$lib/api/client';
import { createSessionGate } from '$lib/session-gate';
import { getAccess, getRefresh, setTokens, clearTokens } from '$lib/api/tokens';

// Matches VITE_API_BASE_URL in .env / the spec's documented fallback (see
// src/lib/api/client.test.ts), so assertions are valid either way.
const BASE = 'http://localhost:3000/api/v1';

const LOGGED_OUT = { loggedIn: false, member: null, roles: [] as string[] };

const SAMPLE_USER: AuthUserResponse = {
  id: 'uuid-1',
  email: 'a@test.com',
  name: '王小明',
  phone: null,
  phone_verified: false,
  avatar_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  roles: ['member']
};

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

/** /auth/refresh 的成功回應:後端連同 user 一起回(AuthResponse)。 */
function rotated(access_token: string, refresh_token: string, user: AuthUserResponse = SAMPLE_USER) {
  return { access_token, refresh_token, user };
}

// authStore is a module singleton backed by tokens.ts (module memory +
// localStorage) and a localStorage profile cache. Reset all three before each
// test. clearTokens() first so the subsequent logout() call below never has a
// refresh token to send (skips the network call entirely — see the "skips the
// network call" test for the same guarantee, asserted explicitly).
beforeEach(async () => {
  clearTokens();
  localStorage.clear();
  await authStore.logout();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authStore', () => {
  it('starts logged out', () => {
    expect(get(isLoggedIn)).toBe(false);
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });
});

describe('authStore.login', () => {
  it('success: POSTs /auth/login without auth, stores tokens, and sets logged-in state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);

    await authStore.login('a@test.com', 'password123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/login`);
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@test.com', password: 'password123' });
    expect(getAccess()).toBe('access-1');
    expect(getRefresh()).toBe('refresh-1');
    const state = get(authStore);
    expect(state.loggedIn).toBe(true);
    expect(state.member?.id).toBe(SAMPLE_USER.id);
    expect(state.member?.name).toBe(SAMPLE_USER.name);
    expect(state.roles).toEqual(['member']);
  });

  it('401: throws ApiError and leaves state and tokens unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid credentials' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authStore.login('a@test.com', 'wrong')).rejects.toBeInstanceOf(ApiError);

    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });
});

describe('authStore.register', () => {
  it('success: POSTs /auth/register, stores tokens, and logs the member in', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);

    await authStore.register('王小明', 'a@test.com', 'password123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/register`);
    expect(JSON.parse(init.body as string)).toEqual({
      name: '王小明',
      email: 'a@test.com',
      password: 'password123'
    });
    expect(get(isLoggedIn)).toBe(true);
    expect(get(authStore).member?.id).toBe(SAMPLE_USER.id);
  });

  it('409 (email already registered): throws ApiError and leaves state unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'registration failed' }, 409, 'Conflict'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authStore.register('王小明', 'a@test.com', 'password123')).rejects.toBeInstanceOf(ApiError);

    expect(get(authStore)).toEqual(LOGGED_OUT);
  });
});

describe('authStore.loginWithGoogle', () => {
  it('success: POSTs /auth/google without auth, stores tokens, and logs the member in (same applySession path as login/register)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'access-3', refresh_token: 'refresh-3', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);

    await authStore.loginWithGoogle('auth-code-xyz');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/google`);
    expect(JSON.parse(init.body as string)).toEqual({ code: 'auth-code-xyz' });
    expect(getAccess()).toBe('access-3');
    expect(getRefresh()).toBe('refresh-3');
    const state = get(authStore);
    expect(state.loggedIn).toBe(true);
    expect(state.member?.id).toBe(SAMPLE_USER.id);
    expect(state.roles).toEqual(['member']);
  });

  it('failure (invalid/expired code): throws ApiError and leaves state and tokens unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid grant' }, 400, 'Bad Request'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authStore.loginWithGoogle('bad-code')).rejects.toBeInstanceOf(ApiError);

    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });
});

describe('authStore.logout', () => {
  it('POSTs /auth/logout with the refresh token, then clears tokens and resets state', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'logged out successfully' }));
    vi.stubGlobal('fetch', fetchMock);
    await authStore.login('a@test.com', 'pw');

    await authStore.logout();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/auth/logout`);
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'r1' });
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });

  it('still clears tokens and resets state even when the logout request fails (fire-and-forget)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }));
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    await authStore.login('a@test.com', 'pw');

    await expect(authStore.logout()).resolves.toBeUndefined();

    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });

  it('skips the network call entirely when there is no refresh token to revoke', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await authStore.logout();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });

  it('clears the session synchronously — a slow revoke response cannot wipe a subsequent login', async () => {
    // Regression: logout() used to await the revoke POST before clearing local
    // state. An un-awaited caller (Sidebar's logout handler) would goto() away
    // immediately; if the user logged back in before the slow revoke resolved,
    // the logout continuation would then clearTokens()+set(LOGGED_OUT), wiping
    // the fresh session. Local sign-out must not depend on network I/O.
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }));
    vi.stubGlobal('fetch', fetchMock);
    await authStore.login('a@test.com', 'pw');

    // Slow revoke endpoint — we control when it resolves.
    let resolveRevoke!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (resolveRevoke = resolve)));

    const logoutPromise = authStore.logout();

    // Signed out IMMEDIATELY — before the revoke response has resolved.
    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    await logoutPromise; // resolves without waiting on the network

    // Log back in while the stale revoke is still in flight.
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a2', refresh_token: 'r2', user: SAMPLE_USER }));
    await authStore.login('a@test.com', 'pw');
    expect(get(authStore).loggedIn).toBe(true);

    // The stale revoke NOW resolves — it must not touch the fresh session.
    resolveRevoke(jsonResponse({ message: 'logged out successfully' }));
    await new Promise((r) => setTimeout(r, 0)); // flush its continuation

    expect(get(authStore).loggedIn).toBe(true);
    expect(get(authStore).member?.id).toBe(SAMPLE_USER.id);
    expect(getAccess()).toBe('a2');
    expect(getRefresh()).toBe('r2');
  });
});

describe('authStore — dreamfly_auth profile cache', () => {
  it('caches the session to localStorage so a reload can first-paint it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);

    await authStore.login('a@test.com', 'pw');

    expect(localStorage.getItem('dreamfly_auth')).toContain(SAMPLE_USER.id);
  });

  it('swallows storage write failures (quota / SSR) instead of propagating', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    await expect(authStore.login('a@test.com', 'pw')).resolves.toBeUndefined();
    expect(get(isLoggedIn)).toBe(true); // in-memory state still updated
  });
});

describe('authStore.hydrate', () => {
  it('without a refresh token: does not call the API and ends logged out', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });

  it('with a valid refresh token: refreshes, fetches /users/me, and populates state', async () => {
    setTokens('stale-access', 'valid-refresh');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(rotated('new-access', 'new-refresh'))); // /auth/refresh
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_USER)); // /users/me
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
    const state = get(authStore);
    expect(state.loggedIn).toBe(true);
    expect(state.member?.id).toBe(SAMPLE_USER.id);
    expect(state.roles).toEqual(['member']);
  });

  it('when the refresh token is invalid/expired: clears tokens and ends logged out', async () => {
    setTokens('stale-access', 'bad-refresh');
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
    expect(get(authStore)).toEqual(LOGGED_OUT);
  });
});

// FE-3 修波:/users/me 非 401 的失敗(5xx/網路)不是 session 過期——不碰 token、不改登入狀態。
describe('authStore.hydrate — /users/me unavailable', () => {
  it('/users/me 503: keeps tokens and state; no auth-cache write, no token removal', async () => {
    // 從已登入 A 開始(重載時快取已是 A):refresh 回的 user 與畫面同一人,不換身分。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(rotated('stale-access', 'valid-refresh'))));
    await authStore.login('a@test.com', 'pw');
    const cached = localStorage.getItem('dreamfly_auth');
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse(rotated('new-access', 'new-refresh'))); // /auth/refresh
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable')); // /users/me
    vi.stubGlobal('fetch', fetchMock);
    const before = get(authStore);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');

    await authStore.hydrate();

    expect(getAccess()).toBe('new-access');
    expect(getRefresh()).toBe('new-refresh');
    expect(get(authStore)).toBe(before);
    // Only the successful refresh's rotation writes; the failed /users/me writes nothing.
    expect(setItem.mock.calls).toEqual([['dreamfly_refresh', 'new-refresh']]);
    expect(removeItem).not.toHaveBeenCalled();
    expect(localStorage.getItem('dreamfly_auth')).toBe(cached);
  });
});

// 最終檢視 I-1 / FE-3 :89:refresh 失敗但 token 沒被清(後端節流/暫時不可用)→ hydrate 直接返回,狀態不動。
describe('authStore.hydrate — refresh unavailable', () => {
  it('/auth/refresh 429: keeps tokens and state, never calls /users/me', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER })));
    await authStore.login('a@test.com', 'pw');
    const before = get(authStore);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'too many requests' }, 429, 'Too Many Requests'));
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/auth/refresh`);
    expect(getAccess()).toBe('a1');
    expect(getRefresh()).toBe('r1');
    expect(get(authStore)).toBe(before);
  });
});

// R13 Task 3(T0):會員資料 module 的 PATCH /users/me 成功後,用回應同步 Topbar 等讀
// authStore 的名字——identity key(loggedIn + member.id)不變,不得觸發任何 session gate 重置。
describe('authStore.syncUser', () => {
  async function loginAs(user: AuthUserResponse) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user })));
    await authStore.login(user.email, 'pw');
    vi.unstubAllGlobals();
  }

  it('同 id:更新 member(名字/首字)與 dreamfly_auth 快取,roles 不動', async () => {
    await loginAs(SAMPLE_USER);

    authStore.syncUser({ ...SAMPLE_USER, name: '李大華', roles: ['admin'] });

    const state = get(authStore);
    expect(state.loggedIn).toBe(true);
    expect(state.member?.name).toBe('李大華');
    expect(state.member?.initial).toBe('李');
    expect(state.roles).toEqual(['member']);
    expect(localStorage.getItem('dreamfly_auth')).toContain('李大華');
  });

  it('登出時:no-op(不會把人「同步」回登入態)', () => {
    authStore.syncUser(SAMPLE_USER);

    expect(get(authStore)).toEqual(LOGGED_OUT);
  });

  it('不同 id:no-op(遲到的 A 回應不得寫進 B 的 session)', async () => {
    await loginAs(SAMPLE_USER);
    const before = get(authStore);

    authStore.syncUser({ ...SAMPLE_USER, id: 'uuid-other', name: '別人' });

    expect(get(authStore)).toEqual(before);
  });

  it('identity 不變 → session gate 的 reset 不被呼叫', async () => {
    const { createSessionGate } = await import('$lib/session-gate');
    const reset = vi.fn();
    createSessionGate({ fetch: async () => null, apply: () => {}, reset });
    await loginAs(SAMPLE_USER);
    const calls = reset.mock.calls.length;

    authStore.syncUser({ ...SAMPLE_USER, name: '李大華' });

    expect(reset).toHaveBeenCalledTimes(calls);
  });
});

describe('toMember', () => {
  it('projects id/name/initial/since from the API user, defaulting points to 0', () => {
    const member = toMember(SAMPLE_USER);

    expect(member.id).toBe('uuid-1');
    expect(member.name).toBe('王小明');
    expect(member.initial).toBe('王');
    expect(member.since).toBe('2026-01-01');
    expect(member.points).toBe(0);
  });
});

// R17(FE-3):refresh 失敗真的清掉 token 時,client 的 onSessionExpired 訊號讓 authStore 登出——
// 畫面、dreamfly_auth 快取與 session 閘門都走既有的身分改變那條邊。
describe('authStore — session expiry (onSessionExpired)', () => {
  it('refresh 401 → api() throws ApiError(401), state LOGGED_OUT, cache follows, gate reset exactly once', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }));
    vi.stubGlobal('fetch', fetchMock);
    await authStore.login('a@test.com', 'pw');
    const reset = vi.fn();
    createSessionGate({ fetch: async () => null, apply: () => {}, reset });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')); // original
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid refresh token' }, 401, 'Unauthorized')); // refresh

    const err = (await api('/users/me').catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(JSON.parse(localStorage.getItem('dreamfly_auth') ?? 'null')).toEqual(LOGGED_OUT);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

// R17(FE-3):跨分頁同步。listener 只看「目前 storage」決定(Controller 裁決 9):
// 沒 refresh → 登出;快取身分 ≠ 我且為登入 → 重新水合;其他(含 refresh 只被輪替)不動。
describe('authStore — cross-tab storage sync', () => {
  const USER_B: AuthUserResponse = { ...SAMPLE_USER, id: 'uuid-2', email: 'b@test.com', name: '李大華' };

  function cacheOf(user: ApiUser | null): string {
    return JSON.stringify(user ? { loggedIn: true, member: toMember(user), roles: user.roles } : LOGGED_OUT);
  }

  /** Another tab wrote `key`; storage already holds that tab's final values. */
  function otherTabWrote(key: string | null): void {
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
  }

  async function loginAsA(): Promise<void> {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER })));
    await authStore.login('a@test.com', 'pw');
    vi.unstubAllGlobals();
  }

  function trackGateReset() {
    const reset = vi.fn();
    createSessionGate({ fetch: async () => null, apply: () => {}, reset });
    return reset;
  }

  it('another tab logged out → forget the access token and go LOGGED_OUT (gate reset once)', async () => {
    await loginAsA();
    const reset = trackGateReset();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.removeItem('dreamfly_refresh');
    localStorage.setItem('dreamfly_auth', cacheOf(null));

    otherTabWrote('dreamfly_refresh');

    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('another tab logged in as B → forget A’s access token and hydrate as B', async () => {
    await loginAsA();
    const reset = trackGateReset();
    const fetchMock = vi.fn(async (url: string, _init: RequestInit) =>
      url.endsWith('/auth/refresh')
        ? jsonResponse(rotated('aB2', 'rB2', USER_B))
        : jsonResponse(USER_B)
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    expect(getAccess()).toBeNull(); // A's access is dropped synchronously
    await vi.waitFor(() => expect(get(authStore).member?.id).toBe(USER_B.id));

    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ refresh_token: 'rB' });
    expect(getAccess()).toBe('aB2');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('another tab logged in as B, refresh OK but /users/me fails → B (refresh 回的 user 已換身分),never A’s identity on B’s token', async () => {
    await loginAsA();
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh')
        ? jsonResponse(rotated('aB2', 'rB2', USER_B))
        : jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable')
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));

    expect(get(authStore).member?.id).toBe(USER_B.id);
    expect(getAccess()).toBe('aB2');
    expect(getRefresh()).toBe('rB2');
  });

  it('another tab logged in as B, a stale A cache write lands mid-hydrate and hydrate fails → LOGGED_OUT, never A', async () => {
    await loginAsA();
    let staleWritten = false;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(rotated('aB2', 'rB2', USER_B));
      // A third tab's late syncUser(A) rewrites the shared cache while this tab's hydrate is in flight.
      // 只寫一次:它觸發的重新水合也會打 /users/me,每次都寫就會無限迴圈。
      if (!staleWritten) {
        staleWritten = true;
        localStorage.setItem('dreamfly_auth', cacheOf(SAMPLE_USER));
        otherTabWrote('dreamfly_auth');
      }
      return jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable');
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    // 換 B 的水合(refresh + /users/me),加上舊 A 快取觸發的第二次水合(refresh + /users/me)。
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await new Promise((r) => setTimeout(r, 0));

    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
  });

  it('an earlier hydrate’s /users/me (sent under A) resolving after the B switch does not apply A', async () => {
    await loginAsA();
    let releaseA!: (r: unknown) => void;
    let meCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return getRefresh() === 'rB'
          ? jsonResponse(rotated('aB2', 'rB2', USER_B))
          : jsonResponse(rotated('a2', 'r2'));
      }
      meCalls += 1;
      return meCalls === 1 ? new Promise((r) => (releaseA = r)) : jsonResponse(USER_B);
    });
    vi.stubGlobal('fetch', fetchMock);

    const hydratingA = authStore.hydrate(); // e.g. a reload-time hydrate, /users/me in flight under A
    await vi.waitFor(() => expect(meCalls).toBe(1));

    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));
    otherTabWrote('dreamfly_auth');
    await vi.waitFor(() => expect(get(authStore).member?.id).toBe(USER_B.id));

    releaseA(jsonResponse(SAMPLE_USER)); // A's stale /users/me lands last
    await hydratingA;

    expect(get(authStore).member?.id).toBe(USER_B.id);
    expect(getRefresh()).toBe('rB2');
  });

  it('B switch whose /users/me fails after this tab logged in as C → C session kept, not logged out', async () => {
    await loginAsA();
    const USER_C = { ...SAMPLE_USER, id: 'uuid-3', email: 'c@test.com' };
    let releaseB!: (r: unknown) => void;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(rotated('aB2', 'rB2', USER_B));
      if (url.endsWith('/auth/login')) return jsonResponse({ access_token: 'aC', refresh_token: 'rC', user: USER_C });
      return new Promise((r) => (releaseB = r));
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    await vi.waitFor(() => expect(releaseB).toBeDefined());
    await authStore.login('c@test.com', 'pw');
    releaseB(jsonResponse({ error: 'unavailable' }, 503, 'Service Unavailable'));
    await new Promise((r) => setTimeout(r, 0));

    expect(get(authStore).member?.id).toBe(USER_C.id);
    expect(getAccess()).toBe('aC');
  });

  it('reload: another tab rotates the refresh token while /users/me is in flight → fresh profile still applied', async () => {
    await loginAsA(); // 重載時快取已是 A(r1):refresh 回的 user 同一人,不換身分
    const renamed = { ...SAMPLE_USER, name: 'NEW', roles: ['member', 'admin'] };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(rotated('a2', 'r2'));
      localStorage.setItem('dreamfly_refresh', 'r3'); // the other tab's own hydrate rotates (same session)
      otherTabWrote('dreamfly_refresh');
      return jsonResponse(renamed);
    });
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(get(authStore).roles).toEqual(['member', 'admin']);
  });

  it('same tab: /users/me 401 → api() refresh + retry (rotation) → fresh profile still applied', async () => {
    await loginAsA(); // 重載時快取已是 A(r1):refresh 回的 user 同一人,不換身分
    let me = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh'))
        return getRefresh() === 'r1'
          ? jsonResponse(rotated('a2', 'r2'))
          : jsonResponse(rotated('a3', 'r3'));
      me += 1;
      return me === 1 ? jsonResponse({ error: 'expired' }, 401, 'Unauthorized') : jsonResponse(SAMPLE_USER);
    });
    vi.stubGlobal('fetch', fetchMock);

    await authStore.hydrate();

    expect(get(authStore).member?.id).toBe(SAMPLE_USER.id);
  });

  it('3 tabs: B switch, a sibling tab rotates B while this tab’s /users/me is in flight → still ends as B', async () => {
    await loginAsA();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/auth/refresh')) return jsonResponse(rotated('aB2', 'rB2', USER_B));
      localStorage.setItem('dreamfly_refresh', 'rB3'); // sibling tab's own B hydrate rotates rB2→rB3
      return jsonResponse(USER_B);
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));

    expect(get(authStore).member?.id).toBe(USER_B.id);
  });

  it('only rotation (same identity, new refresh token) → no action: no refresh, access kept, no reset', async () => {
    await loginAsA();
    const reset = trackGateReset();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'r1-rotated-by-other-tab');

    otherTabWrote('dreamfly_refresh');
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAccess()).toBe('a1');
    expect(get(authStore).member?.id).toBe(SAMPLE_USER.id);
    expect(reset).not.toHaveBeenCalled();
    expect(getRefresh()).toBe('r1-rotated-by-other-tab'); // the listener never writes the shared key
  });

  it('key: null (another tab cleared storage) → LOGGED_OUT', async () => {
    await loginAsA();
    localStorage.clear();

    otherTabWrote(null);

    expect(get(authStore)).toEqual(LOGGED_OUT);
    expect(getAccess()).toBeNull();
  });

  it('another tab logged out then straight back in as the same member → decided from current storage: no flash, no action', async () => {
    await loginAsA();
    const reset = trackGateReset();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const seen: boolean[] = [];
    const unsubscribe = authStore.subscribe((s) => seen.push(s.loggedIn));
    // Both writes landed before this tab handles the first event.
    localStorage.setItem('dreamfly_refresh', 'r1-relogin');
    localStorage.setItem('dreamfly_auth', cacheOf(SAMPLE_USER));

    otherTabWrote('dreamfly_refresh'); // the logout's removal
    otherTabWrote('dreamfly_auth'); // the logout's LOGGED_OUT cache write
    otherTabWrote('dreamfly_refresh'); // the login's token
    otherTabWrote('dreamfly_auth'); // the login's cache write
    unsubscribe();

    expect(seen).not.toContain(false);
    expect(get(authStore).member?.id).toBe(SAMPLE_USER.id);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  // R18 W1:refresh 換出 B 的憑證時,畫面同一拍換成 B;A 畫面發的請求不得頂著 B 的憑證重送。
  it('換登空檔:A 畫面發的 PATCH 遇 401 → ApiError(401),從沒帶過 aB2', async () => {
    await loginAsA();
    const fetchMock = vi.fn(async (url: string, _init: RequestInit) =>
      url.endsWith('/auth/refresh')
        ? jsonResponse(rotated('aB2', 'rB2', USER_B))
        : jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB'); // 別的分頁換登成 B;storage 事件尚未送達

    const err = (await api('/users/me', { method: 'PATCH', body: JSON.stringify({ name: 'x' }) }).catch((e) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    const bearers = fetchMock.mock.calls.map(([, init]) => new Headers(init.headers).get('Authorization'));
    expect(bearers).not.toContain('Bearer aB2');
  });

  it('換成 B:refresh 一落地身分就是 B,不等 /users/me', async () => {
    await loginAsA();
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/auth/refresh') ? jsonResponse(rotated('aB2', 'rB2', USER_B)) : new Promise(() => {}) // /users/me 永不回
    );
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('dreamfly_refresh', 'rB');
    localStorage.setItem('dreamfly_auth', cacheOf(USER_B));

    otherTabWrote('dreamfly_auth');
    await vi.waitFor(() => expect(getAccess()).toBe('aB2'));

    expect(get(authStore).member?.id).toBe(USER_B.id);
  });

  it('storage 已是 rB、沒收到 storage 事件,遇 401 → 最後是 B', async () => {
    await loginAsA();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/refresh')
          ? jsonResponse(rotated('aB2', 'rB2', USER_B))
          : jsonResponse({ error: 'token expired' }, 401, 'Unauthorized')
      )
    );
    localStorage.setItem('dreamfly_refresh', 'rB');

    await api('/users/me').catch(() => {});

    expect(get(authStore).member?.id).toBe(USER_B.id);
    expect(getAccess()).toBe('aB2');
  });

  it('ignores keys it does not own', async () => {
    await loginAsA();
    localStorage.removeItem('dreamfly_refresh');

    otherTabWrote('dreamfly_cart_v3');

    expect(get(authStore).loggedIn).toBe(true);
  });
});

describe('sessionIdentity(身分 key 單一來源)', () => {
  it('未登入 → null', () => {
    expect(sessionIdentity({ loggedIn: false, member: null })).toBeNull();
  });
  it('登入且有 member → member.id', () => {
    expect(sessionIdentity({ loggedIn: true, member: { id: 'u1' } as never })).toBe('u1');
  });
  it('登入但無 member → 空字串(與未登入的 null 區分)', () => {
    expect(sessionIdentity({ loggedIn: true, member: null })).toBe('');
  });
  it('未登入即使殘留 member 也是 null', () => {
    expect(sessionIdentity({ loggedIn: false, member: { id: 'u1' } as never })).toBeNull();
  });
});
