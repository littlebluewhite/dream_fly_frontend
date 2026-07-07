import { describe, it, expect } from 'vitest';
import { mobileAdminGuardTarget, mobileAdminRootTarget, MOBILE_ADMIN_LOGIN_PATH } from './guard';

describe('mobileAdminGuardTarget — /mobile-admin/{admin,coach}/* layout guard', () => {
	it('never redirects away from the login page itself (no redirect loop)', () => {
		expect(mobileAdminGuardTarget(MOBILE_ADMIN_LOGIN_PATH, false, [])).toBeNull();
		expect(mobileAdminGuardTarget(MOBILE_ADMIN_LOGIN_PATH, true, ['member'])).toBeNull();
	});

	it('paths with no role segment (bare root) are left to mobileAdminRootTarget', () => {
		expect(mobileAdminGuardTarget('/mobile-admin', false, [])).toBeNull();
		expect(mobileAdminGuardTarget('/mobile-admin', true, ['admin'])).toBeNull();
	});

	it('not logged in → redirects to /mobile-admin/login regardless of role', () => {
		expect(mobileAdminGuardTarget('/mobile-admin/admin', false, [])).toBe('/mobile-admin/login');
		expect(mobileAdminGuardTarget('/mobile-admin/coach/messages', false, ['admin'])).toBe(
			'/mobile-admin/login'
		);
	});

	it('logged in but missing the portal role → blocked redirect (stays inside mobile-admin)', () => {
		expect(mobileAdminGuardTarget('/mobile-admin/admin', true, ['coach'])).toBe(
			'/mobile-admin/login?blocked=1'
		);
		expect(mobileAdminGuardTarget('/mobile-admin/admin/members', true, ['member'])).toBe(
			'/mobile-admin/login?blocked=1'
		);
		expect(mobileAdminGuardTarget('/mobile-admin/coach', true, [])).toBe('/mobile-admin/login?blocked=1');
	});

	it('logged in with the right role → passes (no redirect)', () => {
		expect(mobileAdminGuardTarget('/mobile-admin/admin', true, ['admin'])).toBeNull();
		expect(mobileAdminGuardTarget('/mobile-admin/coach/students', true, ['coach'])).toBeNull();
		expect(mobileAdminGuardTarget('/mobile-admin/coach', true, ['admin'])).toBeNull(); // admin can also enter coach
	});
});

describe('mobileAdminRootTarget — bare /mobile-admin forward-redirect', () => {
	it('not logged in → login page', () => {
		expect(mobileAdminRootTarget(false, [])).toBe('/mobile-admin/login');
	});

	it('admin role → admin home tab root', () => {
		expect(mobileAdminRootTarget(true, ['admin'])).toBe('/mobile-admin/admin');
	});

	it('coach-only role → coach home tab root', () => {
		expect(mobileAdminRootTarget(true, ['coach'])).toBe('/mobile-admin/coach');
	});

	it('no staff portal access (e.g. plain member) → blocked login', () => {
		expect(mobileAdminRootTarget(true, ['member'])).toBe('/mobile-admin/login?blocked=1');
		expect(mobileAdminRootTarget(true, [])).toBe('/mobile-admin/login?blocked=1');
	});
});
