import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess, getRefresh } from '$lib/api/tokens';

/* Round 4 F2 — mobile Google OAuth callback. Mirrors
 * src/routes/member/login/google/page.test.ts's real page+store integration
 * style 1:1 (authStore is the real singleton, only `fetch` is stubbed); the
 * only differences are the mobile route/redirect targets. */

const BASE = 'http://localhost:3000/api/v1';
const STATE_KEY = 'dreamfly_google_oauth_state';

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

const SAMPLE_USER = {
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

let mockUrl = new URL('http://localhost/mobile/login/google');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));

import Callback from './+page@.svelte';

beforeEach(async () => {
  clearTokens();
  localStorage.clear();
  sessionStorage.clear();
  await authStore.logout();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('mobile Google 登入 callback — state 驗證 + token exchange', () => {
  it('state matches: exchanges the code via POST /auth/google, reuses the password-login token path, and navigates to /mobile', async () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');
    mockUrl = new URL('http://localhost/mobile/login/google?code=auth-code-1&state=good-state');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: SAMPLE_USER })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(Callback);

    await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/mobile'));

    expect(get(isLoggedIn)).toBe(true);
    expect(getAccess()).toBe('access-1');
    expect(getRefresh()).toBe('refresh-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/google`);
    expect(JSON.parse(init.body as string)).toEqual({ code: 'auth-code-1' });
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull(); // consumed
  });

  it('state mismatch: shows a Traditional-Chinese error, never calls /auth/google, and still clears the stashed state', async () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');
    mockUrl = new URL('http://localhost/mobile/login/google?code=auth-code-1&state=wrong-state');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(Callback);

    await vi.waitFor(() => expect(screen.getByText('登入驗證失敗，請重新嘗試')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(screen.getByText('回到登入頁').getAttribute('href')).toBe('/mobile/login');
  });

  it('?error= param (user cancelled on Google\'s side): shows a Traditional-Chinese error and never calls /auth/google', async () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');
    mockUrl = new URL('http://localhost/mobile/login/google?error=access_denied&state=good-state');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(Callback);

    await vi.waitFor(() =>
      expect(screen.getByText('Google 登入已取消或失敗，請重新嘗試')).toBeInTheDocument()
    );

    expect(goto).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
  });

  it('backend rejects the code (e.g. expired/invalid): shows a Traditional-Chinese error and leaves the session unchanged', async () => {
    sessionStorage.setItem(STATE_KEY, 'good-state');
    mockUrl = new URL('http://localhost/mobile/login/google?code=auth-code-1&state=good-state');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid grant' }, 400, 'Bad Request'));
    vi.stubGlobal('fetch', fetchMock);

    render(Callback);

    await vi.waitFor(() => expect(screen.getByText('Google 登入失敗，請稍後再試')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });
});
