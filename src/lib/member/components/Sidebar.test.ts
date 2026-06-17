import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import Sidebar from './Sidebar.svelte';
import { authStore, isLoggedIn } from '$lib/stores/authStore';

// Sidebar links use $page.url.pathname for active state; logout() calls goto().
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/member') })
}));

beforeEach(() => {
  localStorage.clear();
  authStore.logout();
});
afterEach(() => vi.clearAllMocks());

describe('member Sidebar — logout clears the session', () => {
  it('logout() ends the auth session and routes to /member/login', async () => {
    authStore.login();
    expect(get(isLoggedIn)).toBe(true);

    render(Sidebar);
    await fireEvent.click(screen.getByLabelText('登出'));

    expect(get(isLoggedIn)).toBe(false); // authStore.logout() ran
    expect(goto).toHaveBeenCalledWith('/member/login');
  });
});
