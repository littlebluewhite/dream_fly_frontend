/* Dream Fly — auth token storage.
 *
 * Access token lives in module memory only (never persisted — kept out of
 * localStorage so it can't be read back after a reload or exfiltrated the same
 * way a persisted value could). Refresh token persists to localStorage so a
 * page reload doesn't force a re-login; it rotates on every successful
 * refresh (see client.ts). */

const REFRESH_KEY = 'dreamfly_refresh';

let accessToken: string | null = null;

export function getAccess(): string | null {
  return accessToken;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function getRefresh(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REFRESH_KEY);
  }
}
