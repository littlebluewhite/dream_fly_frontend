import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess } from '$lib/api/tokens';

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
  name: '陳小華',
  phone: null,
  phone_verified: false,
  avatar_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  roles: ['member']
};

// Mock nav and the page store, whose ?redirect=/?token= params these pages
// read. The page mock is reassigned per test via the mutable `mockUrl` ref
// before rendering.
let mockUrl = new URL('http://localhost/member/register');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));

import Register from '../../routes/member/register/+page@.svelte';
import Forgot from '../../routes/member/forgot-password/+page@.svelte';
import Reset from '../../routes/member/reset-password/+page@.svelte';

// authStore is a module singleton whose in-memory state persists across tests
// in this file (it's the REAL store here — the register page really calls
// it). clearTokens() first so logout()'s revoke call has no refresh token to
// send and skips the network entirely.
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

describe('member register — auth + redirect', () => {
  it('success: registers, logs in, and goes to /member', async () => {
    mockUrl = new URL('http://localhost/member/register');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }))
    );
    render(Register);

    await fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '陳小華' } });
    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
    await fireEvent.click(screen.getByText('註冊'));
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(get(isLoggedIn)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/member');
    expect(getAccess()).toBe('a1');
  });

  it('respects a ?redirect= param the same way login does (checkout round-trip)', async () => {
    mockUrl = new URL(
      'http://localhost/member/register?redirect=' + encodeURIComponent('/member?checkout=1')
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ access_token: 'a1', refresh_token: 'r1', user: SAMPLE_USER }))
    );
    render(Register);

    await fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '陳小華' } });
    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
    await fireEvent.click(screen.getByText('註冊'));
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(goto).toHaveBeenCalledWith('/member?checkout=1');
  });

  it('409 (email already registered): shows a Traditional Chinese error and leaves the session unchanged', async () => {
    mockUrl = new URL('http://localhost/member/register');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'registration failed' }, 409, 'Conflict')));
    render(Register);

    await fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '陳小華' } });
    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
    await fireEvent.click(screen.getByText('註冊'));
    await vi.waitFor(() => expect(screen.getByText('註冊失敗，請確認資料或稍後再試')).toBeInTheDocument());

    expect(goto).not.toHaveBeenCalled();
    expect(get(isLoggedIn)).toBe(false);
  });
});

describe('member forgot-password — anti-enumeration', () => {
  it('shows the same neutral message on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'if that email exists...' })));
    render(Forgot);

    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.click(screen.getByText('寄送重設連結'));

    await vi.waitFor(() => expect(screen.getByText(/若該 Email 為已註冊帳號/)).toBeInTheDocument());
    expect(screen.queryByLabelText('電子信箱')).toBeNull(); // form is replaced by the message
  });

  it('shows the same neutral message even when the request fails (never leaks whether it worked)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    render(Forgot);

    await fireEvent.input(screen.getByLabelText('電子信箱'), { target: { value: 'a@test.com' } });
    await fireEvent.click(screen.getByText('寄送重設連結'));

    await vi.waitFor(() => expect(screen.getByText(/若該 Email 為已註冊帳號/)).toBeInTheDocument());
  });
});

describe('member reset-password — token handling', () => {
  it('without a ?token= param: shows an invalid-link notice instead of the form', () => {
    mockUrl = new URL('http://localhost/member/reset-password');
    render(Reset);

    expect(screen.getByText('重設連結無效或已過期，請重新申請。')).toBeInTheDocument();
    expect(screen.queryByLabelText('新密碼')).toBeNull();
  });

  it('with a valid token: submits {token, new_password} and shows the success message', async () => {
    mockUrl = new URL('http://localhost/member/reset-password?token=reset-tok-1');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: 'password reset successfully' }));
    vi.stubGlobal('fetch', fetchMock);
    render(Reset);

    await fireEvent.input(screen.getByLabelText('新密碼'), { target: { value: 'newpassword123' } });
    await fireEvent.click(screen.getByRole('button', { name: '重設密碼' }));
    await vi.waitFor(() => expect(screen.getByText('密碼已重設成功，請使用新密碼重新登入。')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/password/reset`);
    expect(JSON.parse(init.body as string)).toEqual({ token: 'reset-tok-1', new_password: 'newpassword123' });
  });

  it('400 (invalid/expired token): shows an error message and stays on the form', async () => {
    mockUrl = new URL('http://localhost/member/reset-password?token=bad-tok');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid or expired token' }, 400, 'Bad Request'))
    );
    render(Reset);

    await fireEvent.input(screen.getByLabelText('新密碼'), { target: { value: 'newpassword123' } });
    await fireEvent.click(screen.getByRole('button', { name: '重設密碼' }));

    await vi.waitFor(() => expect(screen.getByText('重設連結無效或已過期，請重新申請')).toBeInTheDocument());
  });
});
