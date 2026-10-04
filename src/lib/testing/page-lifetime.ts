/* Dream Fly — 「頁面壽命 = 登入身分」的共用情境(R18 W2)。
 *
 * 四個身分相依 layout(member / mobile / coach / mobile-admin)都以 {#key $lastSessionKey} 包住 slot,
 * 情境相同:換人 → 以新身分重掛載重抓、A 遲到的回應不得顯示;同身分重設 → 不重抓;登出 → 不重掛載。
 * 呼叫端的測試檔負責 vi.mock(authStore 用 makeAuthMockA,memberFor 以 email 當 member.id;
 * $lib/api/client 的 api 換成 vi.fn)。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import LayoutProbe from '$lib/testing/layout-probe.fixture.svelte';

const settle = () => new Promise((r) => setTimeout(r, 0));

export function describePageLifetime(name: string, Layout: unknown, baseRoutes: Record<string, unknown> = {}) {
	const probeCalls = () => vi.mocked(api).mock.calls.filter(([p]) => String(p).startsWith('/probe/')).map(([p]) => p);

	describe(`${name} — 頁面壽命 = 登入身分`, () => {
		let resolveA: (v: string) => void;
		beforeEach(async () => {
			authStore.logout();
			await resetSessionStores();
			vi.mocked(api).mockImplementation(
				fakeRouter({
					...baseRoutes,
					'GET /probe/a': () => new Promise<string>((r) => (resolveA = r)),
					'GET /probe/b': 'data-of-b'
				})
			);
		});

		it('A→B 以 B 重抓;A 遲到的回應被丟掉(畫面只剩 B 的資料)', async () => {
			await authStore.login('a', 'pw');
			render(LayoutProbe, { Layout });
			await settle();
			expect(probeCalls()).toEqual(['/probe/a']);

			await authStore.login('b', 'pw');
			await settle();
			expect(probeCalls()).toEqual(['/probe/a', '/probe/b']);

			resolveA('data-of-a');
			await settle();
			expect(screen.getAllByTestId('probe')).toHaveLength(1);
			expect(screen.getByTestId('probe').textContent).toBe('data-of-b');
		});

		it('同一個身分再設一次 → 只讀 1 次', async () => {
			await authStore.login('b', 'pw');
			render(LayoutProbe, { Layout });
			await settle();
			await authStore.login('b', 'pw');
			await settle();
			expect(probeCalls()).toEqual(['/probe/b']);
		});

		it('登出 → 不重掛載(導頁交給 guard,不在導頁前用沒有 token 的狀態再讀一次)', async () => {
			await authStore.login('b', 'pw');
			render(LayoutProbe, { Layout });
			await settle();
			await authStore.logout();
			await settle();
			expect(probeCalls()).toEqual(['/probe/b']);
			expect(screen.getByTestId('probe').textContent).toBe('data-of-b');
		});
	});
}
