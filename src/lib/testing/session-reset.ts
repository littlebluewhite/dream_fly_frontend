/* Dream Fly — session 閘門單例的測試重置(FE-9)。
 *
 * session 閘門(waitlist/leave/notifications/messages)在身分變更時自行重置,測試不再有
 * 專屬的 reset…ForTests 出口:用真的登入 → 登出把身分走一圈,閘門就經由 production 的
 * 同一條路徑回到開機態。authStore 是真的(api 被 vi.mock)或家族 A 的 mock 皆可——兩者的
 * login/logout 都會讓 sessionIdentity 變一次再變回 null。
 *
 * 在 beforeEach 最前面呼叫(它會清掉 api mock 的呼叫紀錄,並還原呼叫前的實作)。 */
import { vi } from 'vitest';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';

const RESET_USER = {
	id: 'u-session-reset', email: 'reset@dreamfly.test', name: '重置', phone: null, phone_verified: false,
	avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member']
};

export async function resetSessionStores(): Promise<void> {
	const mocked = vi.isMockFunction(api) ? vi.mocked(api) : null;
	const prior = mocked?.getMockImplementation();
	mocked?.mockImplementation(
		fakeRouter({
			'POST /auth/login': { access_token: 'at-reset', refresh_token: 'rt-reset', user: RESET_USER },
			'POST /auth/logout': undefined
		})
	);
	await authStore.login(RESET_USER.email, 'pw');
	await authStore.logout();
	if (mocked) {
		mocked.mockClear();
		if (prior) mocked.mockImplementation(prior);
		else mocked.mockReset();
	}
}
