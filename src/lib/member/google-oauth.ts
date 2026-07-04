/* Dream Fly — Google OAuth（member 登入）authorization-code redirect 流程。
 *
 * 純邏輯抽出成獨立模組（同 checkout-gate.ts 的作法），讓 URL 組裝跟 state
 * 產生/驗證/清除可以直接單元測試，不需要 render 元件。實際的 token 交換
 * （POST /auth/google + token 儲存 + authStore 更新）刻意不放在這裡——那段複用
 * authStore.ts 既有的 login()/register() 同一條 applySession 路徑
 * （見 authStore.loginWithGoogle），這裡只管「導去 Google」跟「回來後 state
 * 對不對」。
 *
 * state 防 CSRF：導向 Google 前產生一個不可預測的亂數值存 sessionStorage；
 * callback 拿到 Google 回傳的 state 後跟存的值比對，無論比對成功或失敗都立刻
 * 清除（一次性使用，不能被重放）。 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const CALLBACK_PATH = '/member/login/google';
const STATE_KEY = 'dreamfly_google_oauth_state';

/** `''` when unset/empty — the login page uses this to decide whether to
 *  render the「使用 Google 登入」button at all (progressive enhancement: no
 *  client id configured, no button, app still works password-only). */
export function googleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
}

export function isGoogleLoginEnabled(): boolean {
  return googleClientId() !== '';
}

/** The callback route's absolute URL, computed from the current origin so no
 *  separate env var is needed to keep it in sync across dev/preview/prod. */
export function googleRedirectUri(origin: string): string {
  return `${origin}${CALLBACK_PATH}`;
}

/** Assemble the Google authorization URL. `state` must be the same value the
 *  caller already stashed via startGoogleLogin, so the callback can verify it. */
export function buildGoogleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Kick off the redirect flow: mint a non-guessable CSRF state (crypto
 *  randomness, not a counter/timestamp), stash it, then send the browser to
 *  Google. Called directly from the login page's button click handler. */
export function startGoogleLogin(): void {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  window.location.href = buildGoogleAuthUrl(window.location.origin, state);
}

/** Callback-side CSRF check: does `received` (the callback's `?state=` param)
 *  match the value stashed before the redirect? Always clears the stashed
 *  value first — one-time use whether or not it matches, so a mismatched or
 *  already-consumed value can never be replayed. */
export function consumeGoogleOauthState(received: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!received && !!expected && received === expected;
}
