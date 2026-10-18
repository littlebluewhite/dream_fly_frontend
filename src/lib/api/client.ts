/* Dream Fly — HTTP client for the Dream Fly backend (Axum, /api/v1).
 *
 * Thin fetch wrapper: prefixes the base URL, attaches the Bearer access token,
 * maps non-2xx {"error": msg} bodies to ApiError, and — on a 401 — asks the
 * 登入狀態 core to refresh the token pair once and retries the original request.
 *
 * 401 重送規則 (ADR-0031): a 401 is resent only for the identity that issued the request. If the
 * identity changed before or after the refresh (a re-login, or the refresh came back with someone
 * else's tokens), api() throws the 401 instead: an old screen's write is never resent with the new
 * identity's credentials.
 *
 * Credentials, identity and the refresh itself (single-flight, cross-tab lock,
 * compare-and-set/clear) all belong to the core (stores/login-state.ts); this
 * module only asks it, never stores tokens or calls back into authStore. */

import { apiUrl } from './base-url';
import { accessToken, currentIdentity, refreshFor } from '$lib/stores/login-state';

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
    const token = accessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(apiUrl(path), { ...init, headers });
}

export async function api<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth, ...requestInit } = init;
  const useAuth = auth !== false;

  // 401 重送規則見檔頭:發出時記下身分,遇 401 交給核心的 refreshFor(issuedBy)。refreshFor 的 promise
  // settle 到這裡恢復之間還有 microtask 空檔(換登可能落在其中),所以重送前要在同一拍再比一次身分,比完
  // 立刻同步掛上 Bearer 送出。
  const issuedBy = currentIdentity();
  const response = await sendRequest(path, requestInit, useAuth);

  if (response.status === 401 && useAuth) {
    if (!(await refreshFor(issuedBy)) || currentIdentity() !== issuedBy) {
      throw new ApiError(401, await parseErrorMessage(response));
    }
    return parseResponse<T>(await sendRequest(path, requestInit, useAuth));
  }

  return parseResponse<T>(response);
}
