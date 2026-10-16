import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { tick } from 'svelte';
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

// R14(候選 F3)暖機清單:教練分區的訊息交給身分範圍暖——只替換 api(),數 GET /conversations/me。
// 守門、暖機准入、頁面壽命、關 overlay 的機制在 $lib/components/SessionScope.test.ts 測一次;這裡只留本 layout 的宣告。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';
import { authStore } from '$lib/stores/authStore';
import { overlay } from '$lib/mobile-admin/stores';
import Layout from './+layout.svelte';
import { describeKeyedSlot } from '$lib/testing/page-lifetime';

// 帳號名含 coach 的只有教練角色,其餘都是 admin。
const routes = () => ({ ...loginRoutes((email) => (email.includes('coach') ? ['coach'] : ['admin'])), 'GET /conversations/me': [] });

beforeEach(async () => {
	await resetSessionStores();
	mockUrl = new URL('http://localhost/mobile-admin/admin');
	vi.mocked(api).mockImplementation(fakeRouter(routes()));
});
afterEach(() => vi.clearAllMocks());

describe('mobile-admin +layout — real auth + role guard (Task 20, replaces df_madmin_session/role)', () => {
	it('a logged-out visitor at /mobile-admin/admin is redirected to /mobile-admin/login', () => {
		render(Layout);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login');
	});

	it('an admin visitor at /mobile-admin/admin is not redirected', async () => {
		await authStore.login('admin@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});

	it('an admin visitor may also enter /mobile-admin/coach (admin can view both)', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		await authStore.login('admin@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});

	it('a coach-only visitor at /mobile-admin/admin is bounced to login?blocked=1 (stays inside mobile-admin)', async () => {
		await authStore.login('coach@test.com', 'password123');
		render(Layout);
		expect(goto).toHaveBeenCalledWith('/mobile-admin/login?blocked=1');
	});

	it('a coach-only visitor at /mobile-admin/coach is not redirected', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		await authStore.login('coach@test.com', 'password123');
		render(Layout);
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('mobile-admin +layout — 暖機清單(R14 F3)', () => {
	const convGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/conversations/me').length;
	const settle = () => new Promise((r) => setTimeout(r, 0));

	it('coach 角色(/mobile-admin/coach)打 GET /conversations/me 恰好一次;重新 render 不再打', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		await authStore.login('coach@test.com', 'password123');
		const first = render(Layout);
		await settle();
		expect(convGets()).toBe(1);

		first.unmount();
		render(Layout);
		await settle();
		expect(convGets()).toBe(1);
	});

	// 裁決:暖機看的是所在分區(currentRole),不是帳號角色——admin 帳號進教練分區一樣看得到
	// 訊息角標,所以一樣暖。
	it('admin 帳號進教練分區(/mobile-admin/coach)也暖訊息:GET /conversations/me 恰好一次', async () => {
		mockUrl = new URL('http://localhost/mobile-admin/coach');
		await authStore.login('admin@test.com', 'password123');
		render(Layout);
		await settle();
		expect(convGets()).toBe(1);
	});

	it('admin 角色(/mobile-admin/admin)零次', async () => {
		await authStore.login('admin@test.com', 'password123');
		render(Layout);
		await settle();
		expect(convGets()).toBe(0);
	});
});

describe('mobile-admin +layout — 換人時關掉 overlay', () => {
	it('A→B:overlay 在 slot 外面也會讀個人資料,換人時 closeAll', async () => {
		await authStore.login('a', 'pw');
		render(Layout);
		overlay.push('settings');
		await authStore.login('b', 'pw');
		await tick();
		expect(get(overlay).stack).toHaveLength(0);
	});
});

describeKeyedSlot('mobile-admin +layout', Layout, routes());
