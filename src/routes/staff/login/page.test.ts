import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess, getRefresh } from '$lib/api/tokens';

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}

function apiUser(roles: string[]) {
  return {
    id: 'uuid-1',
    email: 'staff@dreamfly.tw',
    name: '王小明',
    phone: null,
    phone_verified: false,
    avatar_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    roles
  };
}

// Mock nav (submit() calls goto after routing by role) and the page store,
// whose ?blocked=1 param the admin/coach guard round-trip must honour. The
// page mock is reassigned per test via the mutable `mockUrl` ref before
// importing/rendering the component.
let mockUrl = new URL('http://localhost/staff/login');
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({
    get url() {
      return mockUrl;
    }
  })
}));

import StaffLogin from './+page@.svelte';

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
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function submitCredentials() {
  await fireEvent.input(screen.getByLabelText('帳號'), { target: { value: 'staff@dreamfly.tw' } });
  await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
  await fireEvent.click(screen.getByText('登入'));
}

describe('staff login — real auth + role routing', () => {
  it('admin login navigates to /admin', async () => {
    mockUrl = new URL('http://localhost/staff/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['admin']) })
      )
    );
    render(StaffLogin);
    await submitCredentials();
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(goto).toHaveBeenCalledWith('/admin');
    expect(get(isLoggedIn)).toBe(true);
    expect(getAccess()).toBe('access-1');
    expect(getRefresh()).toBe('refresh-1');
  });

  it('coach-only login navigates to /coach', async () => {
    mockUrl = new URL('http://localhost/staff/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['coach']) })
      )
    );
    render(StaffLogin);
    await submitCredentials();
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(goto).toHaveBeenCalledWith('/coach');
    expect(get(isLoggedIn)).toBe(true);
  });

  it('member-only login shows 「此帳號無後台權限」, does not navigate, and logs the session back out', async () => {
    mockUrl = new URL('http://localhost/staff/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['member']) })
      )
    );
    render(StaffLogin);
    await submitCredentials();
    await vi.waitFor(() => expect(screen.getByText('此帳號無後台權限')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it('bad credentials (401) show 「Email 或密碼錯誤」 and do not navigate', async () => {
    mockUrl = new URL('http://localhost/staff/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid credentials' }, 401, 'Unauthorized'))
    );
    render(StaffLogin);
    await submitCredentials();
    await vi.waitFor(() => expect(screen.getByText('Email 或密碼錯誤')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it('empty fields show 「請輸入帳號與密碼」 without calling the API', async () => {
    mockUrl = new URL('http://localhost/staff/login');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(StaffLogin);

    await fireEvent.click(screen.getByText('登入'));

    expect(screen.getByText('請輸入帳號與密碼')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('arriving with ?blocked=1 shows 「此帳號無後台權限」 immediately (bounced back by the admin/coach guard)', () => {
    mockUrl = new URL('http://localhost/staff/login?blocked=1');
    render(StaffLogin);

    expect(screen.getByText('此帳號無後台權限')).toBeInTheDocument();
  });

  it('links to the member login for students/parents', () => {
    mockUrl = new URL('http://localhost/staff/login');
    render(StaffLogin);
    expect(screen.getByText('我是學員 / 家長，前往會員登入').getAttribute('href')).toBe('/member/login');
  });
});
