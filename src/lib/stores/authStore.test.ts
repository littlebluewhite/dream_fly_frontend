import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { authStore, isLoggedIn } from './authStore';
import { ME } from '$lib/member/data';

// authStore is a module singleton backed by localStorage. Reset BOTH the
// in-memory session and storage before each test — clearing localStorage alone
// would leave the singleton's in-memory state from a prior test in place.
beforeEach(() => {
  localStorage.clear();
  authStore.logout();
});
afterEach(() => vi.restoreAllMocks());

describe('authStore', () => {
  it('starts logged out', () => {
    expect(get(isLoggedIn)).toBe(false);
    expect(get(authStore).member).toBe(null);
  });

  it('login() signs in as the member (defaults to ME) and exposes the profile', () => {
    authStore.login();
    expect(get(isLoggedIn)).toBe(true);
    expect(get(authStore).member?.id).toBe(ME.id);
  });

  it('logout() clears the session back to logged-out', () => {
    authStore.login();
    authStore.logout();
    expect(get(isLoggedIn)).toBe(false);
    expect(get(authStore).member).toBe(null);
  });

  it('persists the session to localStorage so it survives a reload', () => {
    authStore.login();
    expect(localStorage.getItem('dreamfly_auth')).toContain(ME.id);
  });

  it('swallows storage write failures (quota / SSR) instead of propagating', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => authStore.login()).not.toThrow();
  });
});
