import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto, replaceState } from '$app/navigation';
import { checkoutOpen } from '$lib/member/stores';
import { resetSessionStores } from '$lib/testing/session-reset';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
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

// R14(候選 F3)暖機清單:layout 以身分為 key 暖通知——只替換 api(),數 GET /notifications。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

import Layout from './+layout.svelte';

beforeEach(async () => {
  localStorage.clear();
  authStore.logout();
  checkoutOpen.set(false);
  await resetSessionStores();
  vi.mocked(api).mockImplementation(fakeRouter({ 'GET /notifications': [] }));
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

describe('member +layout — 暖機清單(R14 F3)', () => {
  const notifGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/notifications').length;
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('登入後 GET /notifications 恰好一次;重新 render 不再打(閘門守衛擋重訪)', async () => {
    authStore.login('member@test.com', 'password123');
    mockUrl = new URL('http://localhost/member');
    const first = render(Layout);
    await settle();
    expect(notifGets()).toBe(1);

    first.unmount();
    render(Layout);
    await settle();
    expect(notifGets()).toBe(1);
  });

  it('未登入零次(守門導走)', async () => {
    mockUrl = new URL('http://localhost/member');
    render(Layout);
    await settle();
    expect(notifGets()).toBe(0);
  });
});
