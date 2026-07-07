import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { goto } from '$app/navigation';

/* mirrors src/routes/member/layout.test.ts's login-guard describe block —
 * mobile has no checkout-gate receiver to test, just the real auth guard
 * that replaced the demo `df_mobile_session` flag (Task 19). */

let mockUrl = new URL('http://localhost/mobile');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
  const { writable, derived } = await import('svelte/store');
  const state = writable({ loggedIn: false, member: null, roles: [] as string[] });
  return {
    authStore: {
      subscribe: state.subscribe,
      login: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
      logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
      hydrate: vi.fn(async () => {})
    },
    isLoggedIn: derived(state, ($s) => $s.loggedIn)
  };
});

import { authStore } from '$lib/stores/authStore';
import Layout from './+layout.svelte';

beforeEach(() => {
  mockUrl = new URL('http://localhost/mobile');
  authStore.logout();
});
afterEach(() => vi.clearAllMocks());

describe('mobile +layout — real auth guard (Task 19, replaces df_mobile_session)', () => {
  it('a logged-out visitor at /mobile is redirected to /mobile/login', () => {
    render(Layout);
    expect(goto).toHaveBeenCalledWith('/mobile/login');
  });

  it('a logged-in visitor at /mobile is not redirected', () => {
    authStore.login('member@test.com', 'password123');
    render(Layout);
    expect(goto).not.toHaveBeenCalled();
  });
});
