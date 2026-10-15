/* Dream Fly — the backend's base URL (Axum, /api/v1). `api()` (client.ts) and the 登入狀態 core
 * (stores/login-state.ts, which POSTs /auth/refresh itself) both build their URLs here, so the core
 * never has to import client.ts. */

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1';

export function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL}${path}`;
}
