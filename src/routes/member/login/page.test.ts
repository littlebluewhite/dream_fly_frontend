import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { isLoggedIn } from '$lib/stores/authStore';

// Mock nav (submit() calls goto after a 650ms timer) and the page store, whose
// ?redirect param the login flow must honour. The page mock is reassigned per
// test via the mutable `mockUrl` ref before importing/rendering the component.
let mockUrl = new URL('http://localhost/member/login');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));

import Login from './+page@.svelte';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

async function submit() {
  await fireEvent.click(screen.getByText('登入'));
  await vi.advanceTimersByTimeAsync(650);
}

describe('member login — auth + redirect', () => {
  it('without a redirect param: logs in and goes to /member', async () => {
    mockUrl = new URL('http://localhost/member/login');
    render(Login);
    await submit();
    expect(get(isLoggedIn)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/member');
  });

  it('with ?redirect: logs in and navigates to the redirect target (checkout round-trip)', async () => {
    mockUrl = new URL('http://localhost/member/login?redirect=' + encodeURIComponent('/member?checkout=1'));
    render(Login);
    await submit();
    expect(get(isLoggedIn)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/member?checkout=1');
  });

  it('social (LINE) login shares the same auth + redirect path', async () => {
    mockUrl = new URL('http://localhost/member/login?redirect=' + encodeURIComponent('/member?checkout=1'));
    render(Login);
    await fireEvent.click(screen.getByLabelText('使用 LINE 登入'));
    await vi.advanceTimersByTimeAsync(650);
    expect(get(isLoggedIn)).toBe(true);
    expect(goto).toHaveBeenCalledWith('/member?checkout=1');
  });
});
