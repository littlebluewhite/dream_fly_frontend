import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess, getRefresh } from '$lib/api/tokens';

const BASE = 'http://localhost:3000/api/v1';

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

// Mock nav (submit() calls goto after a successful login) and the page store,
// whose ?redirect param the login flow must honour. The page mock is
// reassigned per test via the mutable `mockUrl` ref before importing/rendering
// the component.
let mockUrl = new URL('http://localhost/member/login');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));

import Login from './+page@.svelte';

// authStore is a module singleton whose in-memory state persists across tests
// in this file (it's the REAL store here, not mocked — these tests exercise
// the real page+store integration). clearTokens() first so logout()'s revoke
// call has no refresh token to send and skips the network entirely.
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

describe('member login — auth + redirect', () => {
  it('without a redirect param: logs in and goes to /member', async () => {
    mockUrl = new URL('http://localhost/member/login');
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
    expect(goto).toHaveBeenCalledWith('/member');
    expect(getAccess()).toBe('access-1');
    expect(getRefresh()).toBe('refresh-1');
  });

  it('with ?redirect: logs in and navigates to the redirect target (checkout round-trip)', async () => {
    mockUrl = new URL(
      'http://localhost/member/login?redirect=' + encodeURIComponent('/member?checkout=1')
    );
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
    expect(goto).toHaveBeenCalledWith('/member?checkout=1');
  });

  it('401 (wrong credentials): shows「Email 或密碼錯誤」, does not navigate, and leaves the session unchanged', async () => {
    mockUrl = new URL('http://localhost/member/login');
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

  it('still offers no LINE login button (out of scope — Google only, Task 9)', () => {
    mockUrl = new URL('http://localhost/member/login');
    render(Login);
    expect(screen.queryByLabelText('使用 LINE 登入')).toBeNull();
  });

  it('links to the real register and forgot-password pages', () => {
    mockUrl = new URL('http://localhost/member/login');
    render(Login);
    expect(screen.getByText('立即註冊').getAttribute('href')).toBe('/member/register');
    expect(screen.getByText('忘記密碼？').getAttribute('href')).toBe('/member/forgot-password');
  });
});

describe('member login — Google 登入 button (progressive enhancement)', () => {
  it('is absent when VITE_GOOGLE_CLIENT_ID is unset — the app still works password-only', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    mockUrl = new URL('http://localhost/member/login');
    render(Login);

    expect(screen.queryByLabelText('使用 Google 登入')).toBeNull();
  });

  it('is present when VITE_GOOGLE_CLIENT_ID is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    mockUrl = new URL('http://localhost/member/login');
    render(Login);

    expect(screen.getByLabelText('使用 Google 登入')).toBeInTheDocument();
  });

  it('clicking it redirects to Google with the correct params and stashes state (for the callback\'s CSRF check)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');
    vi.stubGlobal('location', { href: '', origin: 'http://localhost:5173' });
    mockUrl = new URL('http://localhost/member/login');
    render(Login);

    await fireEvent.click(screen.getByLabelText('使用 Google 登入'));

    const url = new URL(window.location.href);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/member/login/google');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();
    expect(sessionStorage.getItem('dreamfly_google_oauth_state')).toBe(state);
  });
});
