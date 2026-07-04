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
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(REFRESH_KEY, refresh);
    }
  } catch (error) {
    // Quota exceeded / storage blocked — memory state above still holds.
    console.error('Failed to persist refresh token to storage:', error);
  }
}

export function getRefresh(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  } catch (error) {
    // In hardened/sandboxed contexts the localStorage accessor itself throws
    // SecurityError — which the typeof guard alone doesn't shield against.
    console.error('Failed to read refresh token from storage:', error);
    return null;
  }
}

export function clearTokens(): void {
  accessToken = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(REFRESH_KEY);
    }
  } catch (error) {
    // Storage removal may throw; the in-memory clear above must still stand.
    console.error('Failed to remove refresh token from storage:', error);
  }
}
