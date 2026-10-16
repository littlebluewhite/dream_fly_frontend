import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { goto } from '$app/navigation';

/* Task 20 — 根 /mobile-admin 索引：真 authStore 驅動的角色首頁轉導（取代示範性的
 * df_madmin_session/df_madmin_role localStorage 判斷）。純轉導邏輯本身已在
 * guard.test.ts 對 mobileAdminRootTarget() 詳盡覆蓋，這裡只驗證元件真的把
 * $authStore 狀態接上 goto()。 */

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';
import Page from './+page.svelte';

// 角色取自 email 的帳號名:admin@… → ['admin']、coach@… → ['coach']、member@… → ['member']。
const rolesFor = (email: string) => [email.split('@')[0]];

beforeEach(async () => {
	await resetSessionStores();
	vi.mocked(api).mockImplementation(fakeRouter(loginRoutes(rolesFor)));
});
afterEach(() => vi.clearAllMocks());

describe('/mobile-admin root — real-auth forward redirect', () => {
	it('not logged in → /mobile-admin/login', () => {
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login');
	});

	it('admin role → /mobile-admin/admin', async () => {
		await authStore.login('admin@dreamfly.test', 'pw');
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/admin');
	});

	it('coach-only role → /mobile-admin/coach', async () => {
		await authStore.login('coach@dreamfly.test', 'pw');
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/coach');
	});

	it('no staff portal (plain member) → blocked login', async () => {
		await authStore.login('member@dreamfly.test', 'pw');
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login?blocked=1');
	});
});
