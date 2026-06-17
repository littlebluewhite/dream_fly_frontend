/* Dream Fly — auth-at-checkout session state.
 *
 * Guests browse and fill a cart without logging in; login is required only at
 * checkout. This module-singleton store holds the (mock) logged-in session and
 * persists it to localStorage so a reload keeps you signed in — mirroring the
 * cartStore persistence pattern (SSR guard + load + subscribe write-back). */

import { writable, derived } from 'svelte/store';
import { ME, type Member } from '$lib/member/data';

const AUTH_STORAGE_KEY = 'dreamfly_auth';

export interface AuthState {
  loggedIn: boolean;
  member: Member | null;
}

const LOGGED_OUT: AuthState = { loggedIn: false, member: null };

function loadAuthFromStorage(): AuthState {
  if (typeof window === 'undefined') return LOGGED_OUT;
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : LOGGED_OUT;
  } catch (error) {
    console.error('Failed to load auth from storage:', error);
    return LOGGED_OUT;
  }
}

function createAuthStore() {
  const { subscribe, set } = writable<AuthState>(loadAuthFromStorage());

  if (typeof window !== 'undefined') {
    subscribe((state) => {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save auth to storage:', error);
      }
    });
  }

  return {
    subscribe,
    /** Sign in. Single mock account, so this defaults to ME. */
    login: (member: Member = ME) => set({ loggedIn: true, member }),
    logout: () => set(LOGGED_OUT)
  };
}

export const authStore = createAuthStore();

export const isLoggedIn = derived(authStore, ($a) => $a.loggedIn);
