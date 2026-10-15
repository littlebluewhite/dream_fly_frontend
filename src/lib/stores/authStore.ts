/* Dream Fly — API-backed auth session state.
 *
 * Guests browse and fill a cart without logging in; login is required only at
 * checkout. This is the public face of 登入狀態: the rules (token pair, refresh,
 * session generation, hydrate, cross-tab sync, the `dreamfly_auth` first-paint
 * cache) live in the core, `stores/login-state.ts`; this module calls the
 * `/auth/*` endpoints through `api()` and hands the results to the core. */

import { derived, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import {
  loginState,
  startSession,
  endSession,
  hydrateSession,
  watchOtherTabs,
  syncUser,
  sessionIdentity
} from '$lib/stores/login-state';
import type { AuthResponse, UserResponse } from '$lib/api/generated';

export { sessionIdentity, toMember, type AuthState, type ApiUser } from '$lib/stores/login-state';

/** GET /users/me — the transport port the core's hydrate and cross-tab listener read through. */
const fetchMe = () => api<UserResponse>('/users/me');

function createAuthStore() {
  async function login(email: string, password: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    });
    startSession(res);
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
      auth: false
    });
    startSession(res);
  }

  /** Google OAuth authorization-code exchange (member login, Task 9). The
   *  callback route verifies `state` (CSRF) and then hands the `code` here;
   *  success runs through the exact same startSession as login()/register()
   *  above — token storage + auth state are never reinvented per login
   *  method. First login auto-creates a `member` account; if the email is
   *  already a password account, the backend auto-links the Google identity
   *  (see docs/api/integration-contract.md §3.1). */
  async function loginWithGoogle(code: string): Promise<void> {
    const res = await api<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ code }),
      auth: false
    });
    startSession(res);
  }

  async function logout(): Promise<void> {
    // Local sign-out happens synchronously, BEFORE the network revoke — state
    // truth must never depend on network I/O. If this awaited the revoke, an
    // un-awaited caller (Sidebar's logout handler) could race it: log back in
    // while the slow revoke is in flight, and its continuation would then wipe
    // the fresh session. endSession() hands back the token it just dropped.
    const refresh = endSession();
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
    await hydrateSession(fetchMe);
  }

  watchOtherTabs(fetchMe);

  return { subscribe: loginState.subscribe, login, register, loginWithGoogle, logout, hydrate, syncUser };
}

export const authStore = createAuthStore();

export const isLoggedIn = derived(authStore, ($a) => $a.loggedIn);

// 身分 key(原始值;derived 只在身分變化時才通知,同身分的 syncUser 改名不會觸發)。
export const sessionKey = derived(authStore, sessionIdentity);

/** 「最近一次登入的身分」:key 變 null(登出)時不通知,保留上一個身分。
 *  頁面壽命用:A→B、null→A 重掛載;A→null 不重掛載(登出是先 logout() 再 goto(),
 *  若登出就重掛載,頁面會在導頁前以沒有 token 的狀態再讀一次),交給 guard 導頁。 */
export function lastLoggedIn(key: Readable<string | null>): Readable<string | null> {
  return derived(key, ($k, set) => { if ($k !== null) set($k); }, null as string | null);
}
export const lastSessionKey = lastLoggedIn(sessionKey); // 頁面壽命用;閘門不得用(ADR-0026 §6)
