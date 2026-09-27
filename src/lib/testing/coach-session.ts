/* Dream Fly — 真 authStore 登入的教練身分測試 harness(R15 Task 3a·候選 轉手退役)。
 *
 * 搬自 coach/api.test.ts:62-82(R13 Task 7·C6)：教練身分由 coach/api.ts 模組內的
 * session 閘門快取，identity 由真 login/logout 驅動，不是靠 module mock 偽造。凡是
 * 會經過這條閘門的測試(coach/api.test 本身，以及 mobile-admin 教練側改走 fakeRouter
 * 後同樣會觸發 GET /users/me + GET /coaches 身分解析的測試)都改用這支共用 loginAs()，
 * 每個測試各自的 beforeEach 登入自己的身分，避免教練身分快取跨測試殘留。 */
import { vi } from 'vitest';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { authStore } from '$lib/stores/authStore';

export type TestUser = { id: string; email: string; name: string; phone: string | null; last_login: string | null; created_at: string };

export const asLoginUser = (u: TestUser) => ({ ...u, phone_verified: false, avatar_url: null, is_active: true, roles: ['coach'] });
export const authRoutes = (u: TestUser) => ({
	'POST /auth/logout': undefined,
	'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user: asLoginUser(u) }
});

export async function loginAs(u: TestUser) {
	vi.mocked(api).mockImplementation(fakeRouter(authRoutes(u)));
	await authStore.login(u.email, 'pw');
	vi.mocked(api).mockClear();
}
