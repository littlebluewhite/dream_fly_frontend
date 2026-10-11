import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readable } from 'svelte/store';

/* coach +layout 的頁面壽命:slot 以 {#key $lastSessionKey} 包住,換人即以新身分重掛載重抓。
 * 教練 layout 的 guard 讀 $authStore.roles,所以登入的身分帶 coach 角色。 */
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/coach') })
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
	const { makeAuthMockA, FIXTURE_MEMBER } = await import('$lib/testing/auth-mock');
	return makeAuthMockA({
		roleFor: () => ['coach'],
		memberFor: (email) => ({ ...FIXTURE_MEMBER, id: email })
	});
});

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { render } from '@testing-library/svelte';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { hydrateConversations } from '$lib/coach/conversations';
import { describePageLifetime } from '$lib/testing/page-lifetime';
import Layout from './+layout.svelte';

afterEach(() => vi.clearAllMocks());

// R20 候選 02:coach layout 以身分為 key 暖教練對話列表(桌面側欄的訊息中心角標讀它)——
// 只替換 api(),數 GET /conversations/me。
describe('coach +layout — 暖機清單(R20)', () => {
	const convGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/conversations/me').length;
	const settle = () => new Promise((r) => setTimeout(r, 0));

	beforeEach(async () => {
		authStore.logout();
		await resetSessionStores();
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': [] }));
	});

	it('教練登入打 GET /conversations/me 恰好一次;重新 render 不再打', async () => {
		await authStore.login('coach@test.com', 'pw');
		const first = render(Layout);
		await settle();
		expect(convGets()).toBe(1);

		first.unmount();
		render(Layout);
		await settle();
		expect(convGets()).toBe(1);
	});

	it('layout 暖機與頁面同時 hydrate(工作台 onMount)合併成同一支在飛 GET:第一次進頁仍是 1 次', async () => {
		await authStore.login('coach@test.com', 'pw');
		render(Layout);
		await hydrateConversations();
		await settle();
		expect(convGets()).toBe(1);
	});

	it('未登入零次', async () => {
		render(Layout);
		await settle();
		expect(convGets()).toBe(0);
	});

	it('A 換 B 共 2 次(閘門換身分自己重置)', async () => {
		await authStore.login('a@test.com', 'pw');
		render(Layout);
		await settle();
		expect(convGets()).toBe(1);

		await authStore.login('b@test.com', 'pw');
		await settle();
		expect(convGets()).toBe(2);
	});
});

describePageLifetime('coach +layout', Layout, { 'GET /conversations/me': [] });
