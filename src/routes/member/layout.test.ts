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

import Layout from './+layout.svelte';

beforeEach(() => {
  localStorage.clear();
  authStore.logout();
  checkoutOpen.set(false);
});
afterEach(() => vi.clearAllMocks());

describe('member +layout — checkout gate receiver', () => {
  it('a logged-in member with ?checkout=1 opens the checkout dialog and strips the query', () => {
    authStore.login();
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
    expect(goto).toHaveBeenCalledWith(checkoutTarget(false)); // sent through the login round-trip
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('a plain /member landing does NOT open checkout, redirect, or rewrite the URL', () => {
    mockUrl = new URL('http://localhost/member');
    render(Layout);
    expect(get(checkoutOpen)).toBe(false);
    expect(goto).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
