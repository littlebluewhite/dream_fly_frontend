/* Dream Fly — API-backed auth session state.
 *
 * Guests browse and fill a cart without logging in; login is required only at
 * checkout. Truth lives on the server: the refresh token's validity (see
 * hydrate()). localStorage `dreamfly_auth` is downgraded to a member-profile
 * CACHE for first paint only — it lets a reload show the last-known session
 * instantly instead of flashing "logged out" while hydrate() confirms it. */

import { writable, derived } from 'svelte/store';
import { api, refreshTokens } from '$lib/api/client';
import { getRefresh, setTokens, clearTokens } from '$lib/api/tokens';
import type { Member } from '$lib/member/data';

const AUTH_STORAGE_KEY = 'dreamfly_auth';
// Backend has no per-member avatar colour; default to the brand primary token
// (matches Avatar.svelte's own default) until the member surface picks this up.
const DEFAULT_AVATAR_COLOR = 'var(--df-primary)';

export interface AuthState {
  loggedIn: boolean;
  member: Member | null;
  roles: string[];
}

const LOGGED_OUT: AuthState = { loggedIn: false, member: null, roles: [] };

/** User shape returned by POST /auth/{register,login,refresh} (nested under
 *  `user`) and GET /users/me (flat). `last_login` only appears on the latter,
 *  so it's optional here to cover both (see docs/api/integration-contract.md
 *  §3.1/§3.2). */
export interface ApiUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  last_login?: string | null;
  roles: string[];
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: ApiUser;
}

/** id=uuid, initial=name[0], since=created_at 前 10 碼. points/color/age have no
 *  backend counterpart yet — points defaults to 0 here and is filled in later
 *  by the member surface (points-ledger endpoint); color/age are unused by any
 *  current UI beyond the ME mock they used to come from. */
export function toMember(user: ApiUser): Member {
  return {
    id: user.id,
    name: user.name,
    initial: user.name.charAt(0),
    since: user.created_at.slice(0, 10),
    points: 0,
    color: DEFAULT_AVATAR_COLOR,
    age: 0
  };
}

function loadCache(): AuthState {
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
  const { subscribe, set } = writable<AuthState>(loadCache());

  if (typeof window !== 'undefined') {
    subscribe((state) => {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save auth to storage:', error);
      }
    });
  }

  function applyUser(user: ApiUser): void {
    set({ loggedIn: true, member: toMember(user), roles: user.roles });
  }

  function applySession(res: AuthResponse): void {
    setTokens(res.access_token, res.refresh_token);
    applyUser(res.user);
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    });
    applySession(res);
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
      auth: false
    });
    applySession(res);
  }

  async function logout(): Promise<void> {
    // Local sign-out happens synchronously, BEFORE the network revoke — state
    // truth must never depend on network I/O. If this awaited the revoke, an
    // un-awaited caller (Sidebar's logout handler) could race it: log back in
    // while the slow revoke is in flight, and its continuation would then wipe
    // the fresh session. Snapshot the token first — clearTokens() drops it.
    const refresh = getRefresh();
    clearTokens();
    set(LOGGED_OUT);
    if (refresh) {
      // Best-effort revoke of the dropped token (endpoint is idempotent);
      // fire-and-forget — a failed revoke never blocks or undoes the sign-out.
      void api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
        auth: false
      }).catch(() => {});
    }
  }

  async function hydrate(): Promise<void> {
    if (!getRefresh()) {
      set(LOGGED_OUT);
      return;
    }
    const refreshed = await refreshTokens();
    if (!refreshed) {
      set(LOGGED_OUT);
      return;
    }
    try {
      const user = await api<ApiUser>('/users/me');
      applyUser(user);
    } catch {
      clearTokens();
      set(LOGGED_OUT);
    }
  }

  return { subscribe, login, register, logout, hydrate };
}

export const authStore = createAuthStore();

export const isLoggedIn = derived(authStore, ($a) => $a.loggedIn);
