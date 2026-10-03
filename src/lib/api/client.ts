/* Dream Fly — HTTP client for the Dream Fly backend (Axum, /api/v1).
 *
 * Thin fetch wrapper: prefixes the base URL, attaches the Bearer access token,
 * maps non-2xx {"error": msg} bodies to ApiError, and — on a 401 — refreshes
 * the token pair once and retries the original request. Concurrent 401s share
 * a single in-flight refresh: per docs/api/integration-contract.md §1.2, the
 * backend treats a replayed/reused refresh token as credential theft and
 * revokes the whole token family, so at most one refresh may ever be in
 * flight per tab (module-level promise) — and, since the refresh token itself
 * is shared across tabs via localStorage, at most one across the whole
 * browser too, via the Web Locks API where available (see
 * performRefreshExclusive below). */

import { getAccess, setTokens, getRefresh, clearTokens } from './tokens';
import type { AuthResponse } from './generated';

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1';

function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  } catch {
    // Body wasn't valid JSON — fall through to a generic message.
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function sendRequest(path: string, init: RequestInit, useAuth: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (useAuth) {
    const token = getAccess();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${getBaseUrl()}${path}`, { ...init, headers });
}

export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth, ...requestInit } = init;
  const useAuth = auth !== false;

  const response = await sendRequest(path, requestInit, useAuth);

  if (response.status === 401 && useAuth) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      throw new ApiError(401, await parseErrorMessage(response));
    }
    return parseResponse<T>(await sendRequest(path, requestInit, useAuth));
  }

  return parseResponse<T>(response);
}

let inFlightRefresh: Promise<boolean> | null = null;

const REFRESH_LOCK_NAME = 'dreamfly-refresh';

/** POST /auth/refresh with the stored refresh token; rotates the pair on success.
 *  Single-flight: concurrent callers *in this tab* share the one in-flight request. */
export async function refreshTokens(): Promise<boolean> {
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
 *  replayed refresh token as theft and revokes the whole family (see module
 *  docstring). Where the Web Locks API is available, only one tab across the
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

const sessionExpiredListeners = new Set<() => void>();

/** Register a callback for the moment this tab's session really ends: a refresh
 *  failed and performRefresh() cleared the tokens. Fires nowhere else. */
export function onSessionExpired(fn: () => void): void {
  sessionExpiredListeners.add(fn);
}

/** Tokens are cleared only when the session is really over: the backend
 *  explicitly rejected the refresh token (400/401/403), or there was none to
 *  send. A network error, 408/429 or 5xx leaves everything in place — a blip must not log out
 *  every tab. Even on a rejection, compare-and-clear: clear only if the stored
 *  refresh token is still the one this call sent, or storage is already empty
 *  (another tab logged out while the request was in flight). If another tab or
 *  a fresh login replaced it, that newer session stands. This is the single
 *  place tokens are cleared on a failed refresh, and the single place
 *  onSessionExpired fires. */
async function performRefresh(): Promise<boolean> {
  const sent = getRefresh();
  const outcome: RefreshOutcome = sent ? await exchangeRefreshToken(sent) : 'rejected';
  if (outcome === 'ok') {
    return true;
  }
  const now = getRefresh();
  if (outcome === 'rejected' && (now === sent || now === null)) {
    clearTokens();
    sessionExpiredListeners.forEach((fn) => fn());
  }
  return false;
}

/** `rejected`: the backend answered 400/401/403 (token invalid/revoked/expired).
 *  `unavailable`: network error, any other non-2xx (408, 429 rate limit, 5xx…),
 *  or an unreadable success body. */
type RefreshOutcome = 'ok' | 'rejected' | 'unavailable';

/** The only /auth/refresh statuses that are a verdict on the token itself. A 429
 *  (the strict auth rate-limit bucket) or 408 says nothing about the token, so it
 *  must not log every tab out. */
const TOKEN_REJECTED_STATUSES = new Set([400, 401, 403]);

/** POST /auth/refresh; stores the rotated pair on success. Transport only — never clears. */
async function exchangeRefreshToken(refresh: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });
    if (!response.ok) {
      return TOKEN_REJECTED_STATUSES.has(response.status) ? 'rejected' : 'unavailable';
    }
    const data = (await response.json()) as Pick<AuthResponse, 'access_token' | 'refresh_token'>;
    setTokens(data.access_token, data.refresh_token);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
