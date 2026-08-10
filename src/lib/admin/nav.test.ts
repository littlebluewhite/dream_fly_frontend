import { describe, it, expect } from 'vitest';
import { NAV, isActive, resolve } from './nav';

describe('isActive', () => {
	it('keeps the root (儀表板總覽) active only on an exact match', () => {
		expect(isActive('/admin', '/admin')).toBe(true);
		expect(isActive('/admin', '/admin/members')).toBe(false);
		expect(isActive('/admin', '/admin/settings')).toBe(false);
	});
	it('activates deeper links by prefix, including nested child paths', () => {
		expect(isActive('/admin/members', '/admin/members')).toBe(true);
		expect(isActive('/admin/members', '/admin/members/42')).toBe(true);
	});
	it('does not light up a sibling module', () => {
		expect(isActive('/admin/members', '/admin/coaches')).toBe(false);
		expect(isActive('/admin/orders', '/admin')).toBe(false);
	});
});

describe('resolve', () => {
	it('returns crumb + title for the root', () => {
		expect(resolve('/admin')).toEqual(['營運總覽', '全館即時概況']);
	});
	it('returns crumb + title for deeper routes', () => {
		expect(resolve('/admin/members')).toEqual(['學員管理', '報名與出席']);
		expect(resolve('/admin/settings')).toEqual(['系統設定', '場館與權限']);
	});
	it('matches by longest prefix for nested sub-routes', () => {
		expect(resolve('/admin/members/42')).toEqual(['學員管理', '報名與出席']);
	});
	it('falls back to the dashboard meta for unknown paths', () => {
		expect(resolve('/admin/nope')).toEqual(['營運總覽', '全館即時概況']);
	});
});

describe('NAV', () => {
	it('has 10 items', () => {
		expect(NAV).toHaveLength(10);
	});
	it('has the expected href set, in Sidebar order (guards against a verbatim-copy slip)', () => {
		expect(NAV.map((n) => n.href)).toEqual([
			'/admin',
			'/admin/members',
			'/admin/coaches',
			'/admin/classes',
			'/admin/orders',
			'/admin/coupons',
			'/admin/venues',
			'/admin/tickets',
			'/admin/reports',
			'/admin/settings'
		]);
	});
});
