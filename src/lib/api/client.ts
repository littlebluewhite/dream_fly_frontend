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
 *  whole browser runs a refresh at a time; a tab that had to wait re-reads
 *  the stored refresh token once inside the lock, and if it no longer
 *  matches what this tab saw before requesting the lock, some other tab
 *  already rotated it while this one waited — so this tab is already
 *  refreshed and returns true without a second network round trip. Browsers
 *  without navigator.locks (and jsdom in tests) fall back to the direct
 *  call, unchanged from before this cross-tab layer existed. */
async function performRefreshExclusive(): Promise<boolean> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) {
    return performRefresh();
  }

  const before = getRefresh();
  return locks.request(REFRESH_LOCK_NAME, async () => {
    const current = getRefresh();
    if (current && current !== before) {
      return true;
    }
    return performRefresh();
  });
}

async function performRefresh(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) {
    clearTokens();
    return false;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });

    if (!response.ok) {
      clearTokens();
      return false;
    }

    const data = (await response.json()) as { access_token: string; refresh_token: string };
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}
