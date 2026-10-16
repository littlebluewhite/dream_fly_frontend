/* Dream Fly — 「頁面壽命 = 登入身分」的共用情境(R18 W2;R21 F3 起機制住身分範圍)。
 *
 * 身分範圍(`$lib/components/SessionScope.svelte`)以 {#key $lastSessionKey} 包住 slot,情境:換人 → 以新身分
 * 重掛載重抓、A 遲到的回應不得顯示;同身分重設 → 不重抓;登出 → 不重掛載。
 *   - describePageLifetime:整組情境,在 SessionScope.test 對身分範圍跑一次(props 原樣轉給元件)。
 *   - describeKeyedSlot:四個身分相依 layout 各跑一次的宣告測試——只證明 slot 真的交給了身分範圍(A→B 重掛載)。
 * authStore 是真的:探針路由表併入 loginRoutes()(member.id 就是 email),身分經真的登入狀態核心換。
 * 呼叫端的測試檔負責把 $lib/api/client 的 api 換成 vi.fn。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';
import LayoutProbe from '$lib/testing/layout-probe.fixture.svelte';

const settle = () => new Promise((r) => setTimeout(r, 0));
const probeCalls = () => vi.mocked(api).mock.calls.filter(([p]) => String(p).startsWith('/probe/')).map(([p]) => p);

/** 每個情境前登出、重置 session 閘門,api 換成登入路由 + baseRoutes + 探針路由(A 的回應扣住);回傳「放行 A 的回應」。
 *  baseRoutes 可帶自己的 `...loginRoutes(rolesFor)` 蓋掉預設的 member 角色(角色守門的 layout 用)。 */
function useProbeRoutes(baseRoutes: Record<string, unknown>): (data: string) => void {
	let resolveA: (v: string) => void = () => {};
	beforeEach(async () => {
		await resetSessionStores();
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...loginRoutes(),
				...baseRoutes,
				'GET /probe/a': () => new Promise<string>((r) => (resolveA = r)),
				'GET /probe/b': 'data-of-b'
			})
		);
	});
	return (data) => resolveA(data);
}

function itRemountsOnSwap(Component: unknown, props: Record<string, unknown>, releaseA: (data: string) => void) {
	it('A→B 以 B 重抓;A 遲到的回應被丟掉(畫面只剩 B 的資料)', async () => {
		await authStore.login('a', 'pw');
		render(LayoutProbe, { props: { Layout: Component, props } });
		await settle();
		expect(probeCalls()).toEqual(['/probe/a']);

		await authStore.login('b', 'pw');
		await settle();
		expect(probeCalls()).toEqual(['/probe/a', '/probe/b']);

		releaseA('data-of-a');
		await settle();
		expect(screen.getAllByTestId('probe')).toHaveLength(1);
		expect(screen.getByTestId('probe').textContent).toBe('data-of-b');
	});
}

export function describePageLifetime(name: string, Component: unknown, props: Record<string, unknown> = {}) {
	describe(`${name} — 頁面壽命 = 登入身分`, () => {
		const releaseA = useProbeRoutes({});

		itRemountsOnSwap(Component, props, releaseA);

		it('同一個身分再設一次 → 只讀 1 次', async () => {
			await authStore.login('b', 'pw');
			render(LayoutProbe, { props: { Layout: Component, props } });
			await settle();
			await authStore.login('b', 'pw');
			await settle();
			expect(probeCalls()).toEqual(['/probe/b']);
		});

		it('登出 → 不重掛載(導頁交給 guard,不在導頁前用沒有 token 的狀態再讀一次)', async () => {
			await authStore.login('b', 'pw');
			render(LayoutProbe, { props: { Layout: Component, props } });
			await settle();
			await authStore.logout();
			await settle();
			expect(probeCalls()).toEqual(['/probe/b']);
			expect(screen.getByTestId('probe').textContent).toBe('data-of-b');
		});
	});
}

export function describeKeyedSlot(name: string, Layout: unknown, baseRoutes: Record<string, unknown> = {}) {
	describe(`${name} — slot 交給身分範圍(頁面壽命 = 登入身分)`, () => {
		itRemountsOnSwap(Layout, {}, useProbeRoutes(baseRoutes));
	});
}
