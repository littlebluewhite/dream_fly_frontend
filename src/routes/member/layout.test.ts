import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto, replaceState } from '$app/navigation';
import { checkoutOpen } from '$lib/member/stores';
import { authStore } from '$lib/stores/authStore';
import { checkoutTarget } from '$lib/checkout-gate';

// Receiver half of the checkout gate. The layout reads $page.url and, when it
// carries ?checkout=1, opens the dialog ONLY for a logged-in member (guests are
// bounced through login) and strips the query via replaceState. The whole effect
// is browser-only (replaceState throws on the server). `mockUrl` is set per-test.
let mockUrl = new URL('http://localhost/member');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));
vi.mock('$app/environment', () => ({ browser: true }));

// authStore is API-backed (real network calls); this file only cares about
// the logged-in/out UI state, so mock it with a tiny local store — auth
// mechanics themselves are covered in src/lib/stores/authStore.test.ts.
vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockA } = await import('$lib/testing/auth-mock');
  return makeAuthMockA();
});

import Layout from './+layout.svelte';

beforeEach(() => {
  localStorage.clear();
  authStore.logout();
  checkoutOpen.set(false);
});
afterEach(() => vi.clearAllMocks());

describe('member +layout — checkout gate receiver', () => {
  it('a logged-in member with ?checkout=1 opens the checkout dialog and strips the query', () => {
    authStore.login('member@test.com', 'password123');
    mockUrl = new URL('http://localhost/member?checkout=1');
    render(Layout);
    expect(get(checkoutOpen)).toBe(true);
    expect(replaceState).toHaveBeenCalledWith('/member', {});
    expect(goto).not.toHaveBeenCalled();
  });

  it('a GUEST with ?checkout=1 is redirected to login and the dialog stays shut (no auth bypass)', () => {
    // not logged in (beforeEach logged out)
    mockUrl = new URL('http://localhost/member?checkout=1');
    render(Layout);
    expect(get(checkoutOpen)).toBe(false); // dialog never opens for a guest
    // sent through the login round-trip, preserving the checkout intent — the
    // login guard defers to this (wantsCheckout) instead of firing a second,
    // competing redirect that would drop the ?checkout=1 intent.
    expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
    expect(goto).toHaveBeenCalledTimes(1);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('a logged-in /member landing (no checkout query) does not redirect, open checkout, or rewrite the URL', () => {
    authStore.login('member@test.com', 'password123');
    mockUrl = new URL('http://localhost/member');
    render(Layout);
    expect(get(checkoutOpen)).toBe(false);
    expect(goto).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('member +layout — login guard', () => {
  it('a logged-out /member landing (no checkout query) is redirected to login by the guard', () => {
    // not logged in (beforeEach logged out)
    mockUrl = new URL('http://localhost/member');
    render(Layout);
    expect(get(checkoutOpen)).toBe(false);
    expect(goto).toHaveBeenCalledWith('/member/login?redirect=' + encodeURIComponent('/member'));
    expect(replaceState).not.toHaveBeenCalled();
  });
});
