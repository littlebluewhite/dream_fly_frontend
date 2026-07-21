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

import { authStore } from '$lib/stores/authStore';
import Layout from './+layout.svelte';

beforeEach(() => {
	mockUrl = new URL('http://localhost/mobile-admin/admin');
	authStore.logout();
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
