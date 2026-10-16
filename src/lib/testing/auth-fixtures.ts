/* 登入狀態測試夾具——login-state.test 與 client.test 共用 BASE / LOGGED_OUT / USER_A / USER_B / jsonResponse
 * (authStore.test 只用 BASE / LOGGED_OUT / jsonResponse);需要「有人登入」的元件與頁面測試用 loginRoutes()
 * 經真的登入狀態核心登入。 */
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

/** 經真的登入狀態核心登入用的 route(R22):`POST /auth/login` 依 body 的 email 回一個 user
 *  (`user.id` 就是 email,`toMember` 的結果是名叫王小明的 fixture member),`POST /auth/logout`
 *  回空。呼叫端把它併進自己 fakeRouter 的 route 表,再 `await authStore.login(email, pw)`。
 *  rolesFor 依 email 決定角色;預設一律 ['member']。教練身分照用 coach-session 的 loginAs()。 */
export function loginRoutes(rolesFor: (email: string) => string[] = () => ['member']): Record<string, unknown> {
  return {
    'POST /auth/login': (init: RequestInit) => {
      const { email } = JSON.parse(String(init.body)) as { email: string };
      const user: AuthUserResponse = { ...USER_A, id: email, email, name: '王小明', created_at: '2024-01-01T00:00:00Z', roles: rolesFor(email) };
      return { access_token: `at-${email}`, refresh_token: `rt-${email}`, user };
    },
    'POST /auth/logout': undefined
  };
}
