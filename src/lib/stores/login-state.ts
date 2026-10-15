/* Dream Fly — 登入狀態 (login state) core.
 *
 * The one module that decides who this tab is logged in as. It owns the token pair (through its
 * private storage adapter `api/tokens` — nothing else in production imports it), the `dreamfly_auth`
 * first-paint cache, the session generation, the refresh single-flight + cross-tab Web Lock +
 * rejection table + compare-and-set/clear, the hydrate, and the cross-tab `storage` reaction — so the
 * token and the on-screen identity always switch in the same tick, inside one module.
 *
 * Two callers, one direction each, no callbacks back:
 * - `api()` (client.ts) is a transport that asks it for credentials: `accessToken()`,
 *   `currentIdentity()`, `refreshFor(issuedBy)`.
 * - `authStore.ts` is the public face: it drives `startSession` / `endSession` / `hydrateSession` /
 *   `watchOtherTabs` / `syncUser` and re-exports `loginState` as `$authStore`.
 * It imports neither of them (authStore hands the `/users/me` read in as a `fetchMe` port), so there
 * is no import cycle.
 *
 * Truth lives on the server: the refresh token's validity. `dreamfly_auth` is only a member-profile
 * CACHE for first paint — it lets a reload show the last-known session instantly instead of flashing
 * "logged out" while hydrateSession() confirms it. */

import { writable, get, type Readable } from 'svelte/store';
import { getAccess, setTokens, getRefresh, clearTokens, forgetAccess, REFRESH_KEY } from '$lib/api/tokens';
import { apiUrl } from '$lib/api/base-url';
import { isoDate, initialOf } from '$lib/api/wire';
import type { Member } from '$lib/domain/member-app';
import type { AuthResponse, AuthUserResponse } from '$lib/api/generated';

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

const state = writable<AuthState>(loadCache());

if (typeof window !== 'undefined') {
  state.subscribe((s) => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(s));
    } catch (error) {
      console.error('Failed to save auth to storage:', error);
    }
  });
}

/** 登入狀態本身(`$authStore` 就是它)。唯讀:只有這個 module 寫。 */
export const loginState: Readable<AuthState> = { subscribe: state.subscribe };

function applyUser(user: ApiUser): void {
  state.set({ loggedIn: true, member: toMember(user), roles: user.roles });
}

// session 世代:登入、登出、過期、換身分(跨分頁或 refresh 換出別人)時 +1;refresh token 輪替(同一 session)不動。
// hydrateSession() 進場記下,/users/me 落地時世代變了就是別的 session 的回應,不套用。
let generation = 0;

/** 新 session 狀態開始的唯一入口:世代 +1 並回傳新值(需要比對的呼叫端自己留存)。 */
function beginSession(): number {
  generation += 1;
  return generation;
}

/** 本分頁登入(密碼、註冊、Google 共用):token 與畫面身分同一拍換上。 */
export function startSession(res: AuthResponse): void {
  beginSession();
  setTokens(res.access_token, res.refresh_token);
  applyUser(res.user);
}

/** 本分頁登出:同步結束 session(清 token、LOGGED_OUT),回傳被丟掉的 refresh token,
 *  給呼叫端做 best-effort revoke(沒有就是 null)。 */
export function endSession(): string | null {
  const refresh = getRefresh();
  beginSession();
  clearTokens();
  state.set(LOGGED_OUT);
  return refresh;
}

/** 以 GET/PATCH /users/me 的回應同步目前 session 的 member(R13 Task 3:改名後
 *  Topbar/問候不必等重新登入)。只在「已登入且同一個 member.id」時寫入——identity key
 *  不變,所以任何 session gate 都不會重置;登出或不同 id(遲到的舊帳號回應)一律 no-op。
 *  roles 不動(角色變更不是這條路徑的事)。dreamfly_auth 快取經上方 subscribe 自動跟上。 */
export function syncUser(user: ApiUser): void {
  state.update((s) => (s.loggedIn && s.member?.id === user.id ? { ...s, member: toMember(user) } : s));
}

/** 本分頁記憶體裡的 access token(api() 掛 Bearer 用)。 */
export function accessToken(): string | null {
  return getAccess();
}

/** 目前的畫面身分(`sessionIdentity` of the login state)。 */
export function currentIdentity(): string | null {
  return sessionIdentity(get(state));
}

/** api() 遇 401 時呼叫:只替發出請求的那個畫面身分 refresh。發出後身分已變 → 不 refresh;refresh 換出了
 *  別人的憑證(身分跟著同拍換掉)→ 也回 false。只有 refresh 成功且前後身分都是 `issuedBy` 才回 true。
 *  true 只代表 settle 那一拍的身分仍是 `issuedBy`:呼叫端 await 恢復前還有 microtask 空檔,換登可能落在
 *  其中,所以重送前必須自己同步再比一次 `currentIdentity() === issuedBy`(api() 就這樣做)——
 *  不得用新身分的憑證替舊畫面的寫入重送。 */
export async function refreshFor(issuedBy: string | null): Promise<boolean> {
  if (currentIdentity() !== issuedBy) return false;
  return (await refreshSingleFlight()) && currentIdentity() === issuedBy;
}

/** 回傳 refresh 是否成功:成功即伺服器已確認 token 的主人(compare-and-set 時已同拍換身分)。
 *  `fetchMe` 是 GET /users/me 的 transport port(authStore 傳 `() => api('/users/me')`)。 */
export async function hydrateSession(fetchMe: () => Promise<ApiUser>): Promise<boolean> {
  const gen = generation;
  if (!getRefresh()) {
    state.set(LOGGED_OUT);
    return false;
  }
  const refreshed = await refreshSingleFlight();
  // 失敗時若 token 真的被清掉(後端明確拒絕),refresh 已設 LOGGED_OUT;沒清掉代表
  // 後端暫時不可用(狀態不動),或別的分頁換上了新 session(交給 watchOtherTabs 的 listener)。
  if (!refreshed) return false;
  try {
    const user = await fetchMe();
    // 進場後 session 世代變了(登入/登出/過期/別的分頁換身分):這份是舊 session 的身分,不套用——
    // 新 session 的水合(或 storage listener 的收尾)才是真相。refresh token 只是輪替不算換 session。
    if (generation !== gen) return true;
    applyUser(user);
  } catch {
    // 真的 401 已由 api() → refreshFor() 處理;其他失敗(5xx/網路)不是 session 過期,
    // 不碰 token、不改登入狀態——清共用 refresh token 會讓所有分頁一起登出。
  }
  return true;
}

/** 跨分頁同步:別的分頁改了登入狀態(storage 事件只送到其他分頁)。只看「目前 storage」決定,
 *  不看事件帶的新舊值——refresh key 只是被別的分頁輪替時不得重新水合,否則分頁互相觸發 refresh
 *  永不停。listener 永不寫共用的 refresh key。 */
export function watchOtherTabs(fetchMe: () => Promise<ApiUser>): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== AUTH_STORAGE_KEY && event.key !== REFRESH_KEY) return;
    if (!getRefresh()) {
      beginSession();
      forgetAccess();
      state.set(LOGGED_OUT);
      return;
    }
    const cached = loadCache();
    const expected = sessionIdentity(cached);
    if (cached.loggedIn && expected !== currentIdentity()) {
      const gen = beginSession();
      forgetAccess();
      void hydrateSession(fetchMe).then((refreshed) => {
        if (generation !== gen) return; // 這段期間換了 session(例如本分頁登入 C):收尾不屬於它
        // refresh 成功:伺服器已確認 token 的主人,畫面身分已同拍跟上——即使事件當下的快照是別的分頁
        // 遲到的 syncUser 寫回的舊身分,也以伺服器為準,不登出。
        if (refreshed) return;
        // refresh 暫時不可用,身分又不是事件當下 storage 裡那位:不得用舊身分頂著(可能已是新帳號的)
        // token 打 API——退回登出。比對事件當下的快照,不重讀共用快取。
        if (expected !== currentIdentity()) {
          forgetAccess();
          state.set(LOGGED_OUT);
        }
      });
    }
  });
}

/* ── refresh: single-flight + cross-tab lock + compare-and-set/clear ──────────────────────────────
 *
 * On a 401, `api()` refreshes the token pair once (through refreshFor) and retries. Concurrent 401s
 * share a single in-flight refresh: per docs/api/integration-contract.md §1.2, the backend treats a
 * replayed/reused refresh token as credential theft and revokes the whole token family, so at most one
 * refresh may ever be in flight per tab (module-level promise) — and, since the refresh token itself is
 * shared across tabs via localStorage, at most one across the whole browser too, via the Web Locks API
 * where available (see performRefreshExclusive below). */

let inFlightRefresh: Promise<boolean> | null = null;

const REFRESH_LOCK_NAME = 'dreamfly-refresh';

/** POST /auth/refresh with the stored refresh token; rotates the pair on success.
 *  Single-flight: concurrent callers *in this tab* share the one in-flight request. */
function refreshSingleFlight(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefreshExclusive().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/** Cross-tab exclusive wrapper around performRefresh(). The refresh token is
 *  shared across tabs (localStorage), so two tabs whose access token expires
 *  at the same moment must not both replay it — the backend treats a
 *  replayed refresh token as theft and revokes the whole family (see the
 *  section comment above). Where the Web Locks API is available, only one tab across the
 *  whole browser runs a refresh at a time, and performRefresh() reads the
 *  stored refresh token only once inside the lock: a tab that waited while
 *  another tab rotated the pair therefore exchanges the *current* token for
 *  an access token of its own (access tokens live in each tab's memory, so
 *  the other tab's rotation alone leaves this tab without one). Each refresh
 *  token is presented exactly once; the cost is one extra rotation per
 *  waiting tab. Browsers without navigator.locks (and jsdom in tests) fall
 *  back to the direct call. */
async function performRefreshExclusive(): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) {
    return performRefresh();
  }
  return locks.request(REFRESH_LOCK_NAME, performRefresh);
}

/** Tokens are cleared only when the session is really over: the backend
 *  explicitly rejected the refresh token (400/401/403), or there was none to
 *  send. A network error, 408/429 or 5xx leaves everything in place — a blip must not log out
 *  every tab. Even on a rejection, compare-and-clear: clear only if the stored
 *  refresh token is still the one this call sent, or storage is already empty
 *  (another tab logged out while the request was in flight). If another tab or
 *  a fresh login replaced it, that newer session stands. This is the single
 *  place tokens are cleared on a failed refresh, and the single place the tab
 *  goes LOGGED_OUT because the session expired. A success is compare-and-set the same way: the
 *  rotated pair is stored only if the stored refresh token is still the one
 *  sent; otherwise (a newer login, or a logout, landed during the flight) the
 *  result is dropped and false returned — the newer tokens win. Only a stored
 *  rotation may switch the on-screen identity, to the user the new tokens belong to. */
async function performRefresh(): Promise<boolean> {
  const sent = getRefresh();
  const outcome: RefreshOutcome = sent ? await exchangeRefreshToken(sent) : 'rejected';
  const now = getRefresh();
  if (typeof outcome === 'object') {
    if (now !== sent) return false;
    setTokens(outcome.access_token, outcome.refresh_token);
    // token 屬於別人(別的分頁換登、本分頁還沒收到 storage 事件)就同一拍換畫面身分——不留
    // 「token 是 B、畫面是 A」的空檔。同一人只是輪替,不動。
    if (outcome.user.id !== currentIdentity()) {
      beginSession();
      applyUser(outcome.user);
    }
    return true;
  }
  if (outcome === 'rejected' && (now === sent || now === null)) {
    clearTokens();
    beginSession();
    state.set(LOGGED_OUT);
  }
  return false;
}

/** The rotated pair (and the user it belongs to) on success. `rejected`: the
 *  backend answered 400/401/403 (token invalid/revoked/expired). `unavailable`:
 *  network error, any other non-2xx (408, 429 rate limit, 5xx…), or an
 *  unreadable success body. */
type RefreshOutcome = RotatedPair | 'rejected' | 'unavailable';
type RotatedPair = Pick<AuthResponse, 'access_token' | 'refresh_token' | 'user'>;

/** The only /auth/refresh statuses that are a verdict on the token itself. A 429
 *  (the strict auth rate-limit bucket) or 408 says nothing about the token, so it
 *  must not log every tab out. */
const TOKEN_REJECTED_STATUSES = new Set([400, 401, 403]);

/** POST /auth/refresh. Transport only — never stores or clears tokens. */
async function exchangeRefreshToken(refresh: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });
    if (!response.ok) {
      return TOKEN_REJECTED_STATUSES.has(response.status) ? 'rejected' : 'unavailable';
    }
    const data = (await response.json()) as RotatedPair;
    return { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
  } catch {
    return 'unavailable';
  }
}
