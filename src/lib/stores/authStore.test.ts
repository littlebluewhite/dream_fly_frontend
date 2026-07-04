import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isLoggedIn, toMember, type ApiUser } from './authStore';
import { ApiError } from '$lib/api/client';
import { getAccess, getRefresh, setTokens, clearTokens } from '$lib/api/tokens';

// Matches VITE_API_BASE_URL in .env / the spec's documented fallback (see
// src/lib/api/client.test.ts), so assertions are valid either way.
const BASE = 'http://localhost:3000/api/v1';

const LOGGED_OUT = { loggedIn: false, member: null, roles: [] as string[] };

const SAMPLE_USER: ApiUser = {
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
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' })); // /auth/refresh
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
