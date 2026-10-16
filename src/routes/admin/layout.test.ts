import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { afterNavigate } from '$app/navigation';
import { search } from '$lib/admin/stores';
import { authStore } from '$lib/stores/authStore';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';

/* Pin-first regression（Task 1，R13 小 bug 包）：admin +layout 沒有像 coach +layout
 * 那樣在 afterNavigate 清空 Topbar 的 search store — 從某頁帶著搜尋字串切到另一頁，
 * 字串會跨頁殘留，同 coach/+layout.svelte:36-39 的既有先例。 */
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/admin') })
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import Layout from './+layout.svelte';

beforeEach(async () => {
	await resetSessionStores();
	vi.mocked(api).mockImplementation(fakeRouter(loginRoutes(() => ['admin'])));
	await authStore.login('admin@dreamfly.test', 'pw');
	search.set('');
});
afterEach(() => vi.clearAllMocks());

describe('admin +layout — afterNavigate 清空跨頁殘留的 topbar 搜尋字串（同 coach +layout 先例）', () => {
	it('切換頁面（afterNavigate 觸發）後，search store 被清空', () => {
		search.set('殘留字串');
		render(Layout);

		expect(get(search)).toBe('殘留字串'); // render 當下還沒觸發 afterNavigate

		const onNavigate = vi.mocked(afterNavigate).mock.calls[0][0];
		onNavigate({} as never);

		expect(get(search)).toBe('');
	});
});
