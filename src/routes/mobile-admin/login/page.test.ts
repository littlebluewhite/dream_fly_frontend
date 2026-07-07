import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import { authStore, isLoggedIn } from '$lib/stores/authStore';
import { clearTokens, getAccess, getRefresh } from '$lib/api/tokens';

/* Task 20 — mobile-admin staff login: real POST /auth/login via the same
 * authStore token path desktop staff login uses, replacing the demo
 * df_madmin_session/df_madmin_role localStorage flags (which used to let a
 * visitor freely pick "管理後台" or "教練工作台" with no credentials at all).
 * Mirrors src/routes/staff/login/page.test.ts's real page+store integration
 * style (authStore is the real singleton, only `fetch` is stubbed) — routing
 * target differs (adminPath's mobile-admin tab roots, not desktop's
 * ROLE_HOME). */

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		json: async () => body
	};
}

function apiUser(roles: string[]) {
	return {
		id: 'uuid-1',
		email: 'staff@dreamfly.tw',
		name: '王小明',
		phone: null,
		phone_verified: false,
		avatar_url: null,
		is_active: true,
		created_at: '2026-01-01T00:00:00Z',
		roles
	};
}

let mockUrl = new URL('http://localhost/mobile-admin/login');
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({
		get url() {
			return mockUrl;
		}
	})
}));

import MobileAdminLogin from './+page@.svelte';

beforeEach(async () => {
	mockUrl = new URL('http://localhost/mobile-admin/login');
	clearTokens();
	localStorage.clear();
	await authStore.logout();
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

async function submitCredentials() {
	await fireEvent.input(screen.getByLabelText('帳號'), { target: { value: 'staff@dreamfly.tw' } });
	await fireEvent.input(screen.getByLabelText('密碼'), { target: { value: 'password123' } });
	await fireEvent.click(screen.getByText('登入後台'));
}

describe('mobile-admin login — real auth + role routing (Task 20, replaces df_madmin_session/role)', () => {
	it('admin login navigates to /mobile-admin/admin', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['admin']) })
			)
		);
		render(MobileAdminLogin);
		await submitCredentials();
		await vi.waitFor(() => expect(goto).toHaveBeenCalled());

		expect(goto).toHaveBeenCalledWith('/mobile-admin/admin');
		expect(get(isLoggedIn)).toBe(true);
		expect(getAccess()).toBe('access-1');
		expect(getRefresh()).toBe('refresh-1');
	});

	it('coach-only login navigates to /mobile-admin/coach', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['coach']) })
			)
		);
		render(MobileAdminLogin);
		await submitCredentials();
		await vi.waitFor(() => expect(goto).toHaveBeenCalled());

		expect(goto).toHaveBeenCalledWith('/mobile-admin/coach');
		expect(get(isLoggedIn)).toBe(true);
	});

	it('member-only login shows「此帳號無後台權限」, does not navigate, and logs the session back out', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: apiUser(['member']) })
			)
		);
		render(MobileAdminLogin);
		await submitCredentials();
		await vi.waitFor(() => expect(screen.getByText('此帳號無後台權限')).toBeInTheDocument());

		expect(goto).not.toHaveBeenCalled();
		expect(get(isLoggedIn)).toBe(false);
		expect(getAccess()).toBeNull();
		expect(getRefresh()).toBeNull();
	});

	it('bad credentials (401) show「Email 或密碼錯誤」and do not navigate', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse({ error: 'invalid credentials' }, 401, 'Unauthorized'))
		);
		render(MobileAdminLogin);
		await submitCredentials();
		await vi.waitFor(() => expect(screen.getByText('Email 或密碼錯誤')).toBeInTheDocument());

		expect(goto).not.toHaveBeenCalled();
		expect(get(isLoggedIn)).toBe(false);
	});

	it('empty fields show「請輸入帳號與密碼」without calling the API', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		render(MobileAdminLogin);

		await fireEvent.click(screen.getByText('登入後台'));

		expect(screen.getByText('請輸入帳號與密碼')).toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('arriving with ?blocked=1 shows「此帳號無後台權限」immediately (bounced back by the layout guard)', () => {
		mockUrl = new URL('http://localhost/mobile-admin/login?blocked=1');
		render(MobileAdminLogin);
		expect(screen.getByText('此帳號無後台權限')).toBeInTheDocument();
	});

	it('links to the member login for students/parents', () => {
		render(MobileAdminLogin);
		expect(screen.getByText('我是家長 / 學員 → 前往會員 App').getAttribute('href')).toBe('/mobile');
	});

	it('has no demo role-picker cards and never touches df_madmin_session/role', async () => {
		vi.stubGlobal('fetch', vi.fn());
		render(MobileAdminLogin);
		expect(screen.queryByText('管理後台')).toBeNull();
		expect(screen.queryByText('教練工作台')).toBeNull();
		expect(localStorage.getItem('df_madmin_session')).toBeNull();
		expect(localStorage.getItem('df_madmin_role')).toBeNull();
	});
});
