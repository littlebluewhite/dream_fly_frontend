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

// authStore is API-backed (real network calls); this file only cares about
// the logged-in/out UI state, so mock it with a tiny local store — auth
// mechanics themselves are covered in src/lib/stores/authStore.test.ts.
vi.mock('$lib/stores/authStore', async () => {
  const { writable, derived } = await import('svelte/store');
  const state = writable({ loggedIn: false, member: null, roles: [] as string[] });
  return {
    authStore: {
      subscribe: state.subscribe,
      login: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
      register: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
      logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
      hydrate: vi.fn(async () => {})
    },
    isLoggedIn: derived(state, ($s) => $s.loggedIn)
  };
});

beforeEach(() => {
  localStorage.clear();
  authStore.logout();
});
afterEach(() => vi.clearAllMocks());

describe('member Sidebar — logout clears the session', () => {
  it('logout() ends the auth session and routes to /member/login', async () => {
    authStore.login('member@test.com', 'password123');
    expect(get(isLoggedIn)).toBe(true);

    render(Sidebar);
    await fireEvent.click(screen.getByLabelText('登出'));

    expect(get(isLoggedIn)).toBe(false); // authStore.logout() ran
    expect(goto).toHaveBeenCalledWith('/member/login');
  });
});
