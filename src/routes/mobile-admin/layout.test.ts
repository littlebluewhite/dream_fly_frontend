import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { goto } from '$app/navigation';

/* mirrors src/routes/mobile/layout.test.ts's login-guard describe block —
 * mobile-admin's real auth guard (Task 20, replaces the demo df_madmin_session/
 * df_madmin_role flags). Unlike /mobile (single role), /mobile-admin serves
 * both admin and coach portals from one layout — the guard's portal is derived
 * from the URL's role segment (roleFromPath), so these tests exercise both. */

let mockUrl = new URL('http://localhost/mobile-admin/admin');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({
		get url() {
			return mockUrl;
		}
	})
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
	const { makeAuthMockA } = await import('$lib/testing/auth-mock');
	return makeAuthMockA({ roleFor: (email) => (email.includes('coach') ? ['coach'] : ['admin']) });
});

// R14(候選 F3)暖機清單:教練分區以身分為 key 暖訊息——只替換 api(),數 GET /conversations/me。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { messagesHydrated } from '$lib/mobile-admin/stores';
import { authStore } from '$lib/stores/authStore';
import Layout from './+layout.svelte';

beforeEach(() => {
	mockUrl = new URL('http://localhost/mobile-admin/admin');
	authStore.logout();
	messagesHydrated.set(false);
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': [] }));
});
afterEach(() => vi.clearAllMocks());

describe('mobile-admin +layout — real auth + role guard (Task 20, replaces df_madmin_session/role)', () => {
	it('a logged-out visitor at /mobile-admin/admin is redirected to /mobile-admin/login', () => {
		render(Layout);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login');
	});

	it('an admin visitor at /mobile-admin/admin is not redirected', () => {
		authStore.login('admin@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});

	it('an admin visitor may also enter /mobile-admin/coach (admin can view both)', () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		authStore.login('admin@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});

	it('a coach-only visitor at /mobile-admin/admin is bounced to login?blocked=1 (stays inside mobile-admin)', () => {
		authStore.login('coach@test.com', 'password123');
		render(Layout);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login?blocked=1');
	});

	it('a coach-only visitor at /mobile-admin/coach is not redirected', () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		authStore.login('coach@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('mobile-admin +layout — 暖機清單(R14 F3)', () => {
	const convGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/conversations/me').length;
	const settle = () => new Promise((r) => setTimeout(r, 0));

	it('coach 角色(/mobile-admin/coach)打 GET /conversations/me 恰好一次;重新 render 不再打', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		authStore.login('coach@test.com', 'password123');
		const first = render(Layout);
		await settle();
		expect(convGets()).toBe(1);

		first.unmount();
		render(Layout);
		await settle();
		expect(convGets()).toBe(1);
	});

	it('admin 角色(/mobile-admin/admin)零次', async () => {
		authStore.login('admin@test.com', 'password123');
		render(Layout);
		await settle();
		expect(convGets()).toBe(0);
	});

	it('未登入零次(守門導走)', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		render(Layout);
		await settle();
		expect(convGets()).toBe(0);
	});
});
