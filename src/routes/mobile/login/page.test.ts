import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess, getRefresh } from '$lib/api/tokens';

/* Task 19 — mobile login page: real POST /auth/login via the same authStore
 * token path member uses, replacing the demo df_mobile_session flag (which
 * used to accept ANY phone number, or even no credentials at all via
 * "訪客瀏覽"). Mirrors src/routes/member/login/page.test.ts's real
 * page+store integration style (authStore is the real singleton, only
 * `fetch` is stubbed). */

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

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import Login from './+page@.svelte';

beforeEach(async () => {
  clearTokens();
  localStorage.clear();
  await authStore.logout();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('mobile login — real auth (Task 19, replaces df_mobile_session)', () => {
  it('logs in with real credentials and navigates to /mobile', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: SAMPLE_USER })
      )
    );
    render(Login);

    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
    await fireEvent.click(screen.getByText('登入'));
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(get(isLoggedIn)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/mobile');
    expect(getAccess()).toBe('access-1');
    expect(getRefresh()).toBe('refresh-1');
  });

  it('401 (wrong credentials): shows「Email 或密碼錯誤」, does not navigate, session stays logged out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid credentials' }, 401, 'Unauthorized'))
    );
    render(Login);

    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'wrong-password' } });
    await fireEvent.click(screen.getByText('登入'));
    await vi.waitFor(() => expect(screen.getByText('Email 或密碼錯誤')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it('has no demo "訪客瀏覽" (guest browse) escape hatch and never touches df_mobile_session', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(Login);
    expect(screen.queryByText('先以訪客身分瀏覽')).toBeNull();
    expect(localStorage.getItem('df_mobile_session')).toBeNull();
  });
});

describe('mobile login — Google 登入 button (progressive enhancement, Round 4 F2)', () => {
  it('is absent when VITE_GOOGLE_CLIENT_ID is unset — the app still works password-only', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    render(Login);

    expect(screen.queryByLabelText('使用 Google 登入')).toBeNull();
  });

  it('is present when VITE_GOOGLE_CLIENT_ID is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    render(Login);

    expect(screen.getByLabelText('使用 Google 登入')).toBeInTheDocument();
  });

  it('clicking it redirects to Google with the mobile callback path and stashes state (for the callback\'s CSRF check)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.stubGlobal('location', { href: '', origin: 'http://localhost:5173' });
    render(Login);

    await fireEvent.click(screen.getByLabelText('使用 Google 登入'));

    const url = new URL(window.location.href);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/mobile/login/google');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(sessionStorage.getItem('dreamfly_google_oauth_state')).toBe(state);
  });
});
