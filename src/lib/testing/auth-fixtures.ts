/* 登入狀態測試夾具(R21)——login-state.test 與 client.test 共用一份(F2 把 refresh 測試從 client.test
 * 搬到 login-state.test 時兩邊各留了一份);authStore.test 只共用逐字相同的 BASE / LOGGED_OUT / jsonResponse。 */
import type { AuthUserResponse } from '$lib/api/generated';

// Matches VITE_API_BASE_URL in .env / the spec's documented fallback, so
// assertions are valid whether or not Vite loaded the .env file for the test run.
export const BASE = 'http://localhost:3000/api/v1';

export const LOGGED_OUT = { loggedIn: false, member: null, roles: [] as string[] };

export const USER_A: AuthUserResponse = {
  id: 'uuid-A',
  email: 'a@test.com',
  name: 'A',
  phone: null,
  phone_verified: false,
  avatar_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  roles: ['member']
};
export const USER_B: AuthUserResponse = { ...USER_A, id: 'uuid-B', email: 'b@test.com', name: 'B' };

export function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  };
}
