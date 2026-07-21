import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { goto } from '$app/navigation';

/* Task 20 — 根 /mobile-admin 索引：真 authStore 驅動的角色首頁轉導（取代示範性的
 * df_madmin_session/df_madmin_role localStorage 判斷）。純轉導邏輯本身已在
 * guard.test.ts 對 mobileAdminRootTarget() 詳盡覆蓋，這裡只驗證元件真的把
 * $authStore 狀態接上 goto()。 */

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
	const { makeAuthMockB } = await import('$lib/testing/auth-mock');
	return makeAuthMockB({ withIsLoggedIn: true });
});

import { authStore } from '$lib/stores/authStore';
import type { TestAuthStore } from '$lib/testing/auth-mock';
import Page from './+page.svelte';

beforeEach(() => {
	(authStore as TestAuthStore).__set({ loggedIn: false, member: null, roles: [] });
});
afterEach(() => vi.clearAllMocks());

describe('/mobile-admin root — real-auth forward redirect', () => {
	it('not logged in → /mobile-admin/login', () => {
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login');
	});

	it('admin role → /mobile-admin/admin', () => {
		(authStore as TestAuthStore).__set({ loggedIn: true, member: null, roles: ['admin'] });
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/admin');
	});

	it('coach-only role → /mobile-admin/coach', () => {
		(authStore as TestAuthStore).__set({ loggedIn: true, member: null, roles: ['coach'] });
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/coach');
	});

	it('no staff portal (plain member) → blocked login', () => {
		(authStore as TestAuthStore).__set({ loggedIn: true, member: null, roles: ['member'] });
		render(Page);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login?blocked=1');
	});
});
