/* Dream Fly — API-backed auth session state.
 *
 * Guests browse and fill a cart without logging in; login is required only at
 * checkout. Truth lives on the server: the refresh token's validity (see
 * hydrate()). localStorage `dreamfly_auth` is downgraded to a member-profile
 * CACHE for first paint only — it lets a reload show the last-known session
 * instantly instead of flashing "logged out" while hydrate() confirms it. */

import { writable, derived, get } from 'svelte/store';
import { api, refreshTokens, onSessionExpired } from '$lib/api/client';
import { getRefresh, setTokens, clearTokens, forgetAccess, REFRESH_KEY } from '$lib/api/tokens';
import { isoDate, initialOf } from '$lib/api/wire';
import type { Member } from '$lib/domain/member-app';
import type { AuthResponse, AuthUserResponse, UserResponse } from '$lib/api/generated';

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

/** session 身分 key 的單一來源:未登入 null;登入但無 member.id 退化為空字串。 */
export function sessionIdentity(a: Pick<AuthState, 'loggedIn' | 'member'>): string | null {
  return a.loggedIn ? (a.member?.id ?? '') : null;
}

/** The fields the session reads from a user: POST /auth/{register,login,refresh,google}
 *  nest an AuthUserResponse under `user`; GET/PATCH /users/me return a UserResponse
 *  (a field superset of it), so both satisfy this projection (see
 *  docs/api/integration-contract.md §3.1/§3.2). */
export type ApiUser = Pick<AuthUserResponse, 'id' | 'name' | 'created_at' | 'roles'>;

/** id=uuid, initial=name[0], since=created_at 前 10 碼. points/color/age have no
 *  backend counterpart yet — points defaults to 0 here and is filled in later
 *  by the member surface (points-ledger endpoint); color/age only exist because
 *  the `Member` shape predates the backend (the `ME` mock seed that filled them
 *  retired in R13) — color is a fixed default, age is unused. */
export function toMember(user: ApiUser): Member {
  return {
    id: user.id,
    name: user.name,
    initial: initialOf(user.name),
    since: isoDate(user.created_at),
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
  const { subscribe, set, update } = writable<AuthState>(loadCache());

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

  // session 世代:登入、登出、過期、跨分頁登出/換身分時 +1;refresh token 輪替(同一 session)不動。
  // hydrate() 進場記下,/users/me 落地時世代變了就是別的 session 的回應,不套用。
  let generation = 0;

  function applySession(res: AuthResponse): void {
    generation += 1;
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

  /** Google OAuth authorization-code exchange (member login, Task 9). The
   *  callback route verifies `state` (CSRF) and then hands the `code` here;
   *  success runs through the exact same applySession as login()/register()
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
    applySession(res);
  }

  async function logout(): Promise<void> {
    // Local sign-out happens synchronously, BEFORE the network revoke — state
    // truth must never depend on network I/O. If this awaited the revoke, an
    // un-awaited caller (Sidebar's logout handler) could race it: log back in
    // while the slow revoke is in flight, and its continuation would then wipe
    // the fresh session. Snapshot the token first — clearTokens() drops it.
    const refresh = getRefresh();
    generation += 1;
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
    const gen = generation;
    if (!getRefresh()) {
      set(LOGGED_OUT);
      return;
    }
    const refreshed = await refreshTokens();
    // 失敗時若 token 真的被清掉(後端明確拒絕),onSessionExpired 已設 LOGGED_OUT;沒清掉代表
    // 後端暫時不可用(狀態不動),或別的分頁換上了新 session(交給下方的 storage listener)。
    if (!refreshed) return;
    try {
      const user = await api<UserResponse>('/users/me');
      // 進場後 session 世代變了(登入/登出/過期/別的分頁換身分):這份是舊 session 的身分,不套用——
      // 新 session 的水合(或 storage listener 的收尾)才是真相。refresh token 只是輪替不算換 session。
      if (generation !== gen) return;
      applyUser(user);
    } catch {
      // 真的 401 已由 api() → refreshTokens() 處理;其他失敗(5xx/網路)不是 session 過期,
      // 不碰 token、不改登入狀態——清共用 refresh token 會讓所有分頁一起登出。
    }
  }

  /** 以 GET/PATCH /users/me 的回應同步目前 session 的 member(R13 Task 3:改名後
   *  Topbar/問候不必等重新登入)。只在「已登入且同一個 member.id」時寫入——identity key
   *  不變,所以任何 session gate 都不會重置;登出或不同 id(遲到的舊帳號回應)一律 no-op。
   *  roles 不動(角色變更不是這條路徑的事)。dreamfly_auth 快取經上方 subscribe 自動跟上。 */
  function syncUser(user: ApiUser): void {
    update((s) => (s.loggedIn && s.member?.id === user.id ? { ...s, member: toMember(user) } : s));
  }

  // refresh 失敗、client 真的清掉 token 的那一刻(唯一來源見 client.ts performRefresh)。
  onSessionExpired(() => {
    generation += 1;
    set(LOGGED_OUT);
  });

  // 跨分頁同步:別的分頁改了登入狀態(storage 事件只送到其他分頁)。只看「目前 storage」決定,
  // 不看事件帶的新舊值——refresh key 只是被別的分頁輪替時不得重新水合,否則分頁互相觸發 refresh
  // 永不停。listener 永不寫共用的 refresh key。
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== REFRESH_KEY) return;
      if (!getRefresh()) {
        generation += 1;
        forgetAccess();
        set(LOGGED_OUT);
        return;
      }
      const cached = loadCache();
      const expected = sessionIdentity(cached);
      if (cached.loggedIn && expected !== sessionIdentity(get({ subscribe }))) {
        const gen = (generation += 1);
        forgetAccess();
        void hydrate().then(() => {
          if (generation !== gen) return; // 這段期間換了 session(例如本分頁登入 C):收尾不屬於它
          // hydrate 沒能換成事件當下 storage 裡的身分(refresh 成功但 /users/me 失敗,或 refresh 暫時
          // 不可用):不得用舊身分頂著(可能已是新帳號的)token 打 API——退回登出。比對事件當下的快照,
          // 不重讀共用快取:別的分頁遲到的 syncUser 可能已把它改寫回舊身分。
          if (expected !== sessionIdentity(get({ subscribe }))) {
            forgetAccess();
            set(LOGGED_OUT);
          }
        });
      }
    });
  }

  return { subscribe, login, register, loginWithGoogle, logout, hydrate, syncUser };
}

export const authStore = createAuthStore();

export const isLoggedIn = derived(authStore, ($a) => $a.loggedIn);
