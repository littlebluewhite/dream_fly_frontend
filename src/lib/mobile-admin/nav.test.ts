import { describe, it, expect } from 'vitest';
import { ADMIN_TABS, COACH_TABS, tabsFor, adminPath, isActive, roleFromPath, activeTab } from './nav';

describe('tabsFor', () => {
	it('returns the admin tab set (總覽/學員/課程/訂單/更多)', () => {
		expect(tabsFor('admin')).toBe(ADMIN_TABS);
		expect(ADMIN_TABS.map((t) => t.id)).toEqual(['home', 'members', 'classes', 'orders', 'more']);
	});
	it('returns the coach tab set (工作台/點名/學員/訊息/設定)', () => {
		expect(tabsFor('coach')).toBe(COACH_TABS);
		expect(COACH_TABS.map((t) => t.id)).toEqual(['today', 'attendance', 'students', 'messages', 'csettings']);
	});
});

describe('adminPath', () => {
	it('maps each role home tab to the role root', () => {
		expect(adminPath('admin', 'home')).toBe('/mobile-admin/admin');
		expect(adminPath('coach', 'today')).toBe('/mobile-admin/coach');
	});
	it('maps other tabs under the role base', () => {
		expect(adminPath('admin', 'members')).toBe('/mobile-admin/admin/members');
		expect(adminPath('coach', 'attendance')).toBe('/mobile-admin/coach/attendance');
	});
});

describe('isActive', () => {
	it('keeps a role root active only on an exact match', () => {
		expect(isActive('/mobile-admin/admin', '/mobile-admin/admin')).toBe(true);
		expect(isActive('/mobile-admin/admin', '/mobile-admin/admin/members')).toBe(false);
	});
	it('activates deeper tabs by prefix', () => {
		expect(isActive('/mobile-admin/coach/attendance', '/mobile-admin/coach/attendance')).toBe(true);
		expect(isActive('/mobile-admin/admin/orders', '/mobile-admin/admin/members')).toBe(false);
	});
});

describe('roleFromPath', () => {
	it('extracts the role segment', () => {
		expect(roleFromPath('/mobile-admin/admin')).toBe('admin');
		expect(roleFromPath('/mobile-admin/coach/students')).toBe('coach');
	});
	it('returns null when no role segment is present', () => {
		expect(roleFromPath('/mobile-admin')).toBe(null);
		expect(roleFromPath('/mobile-admin/login')).toBe(null);
	});
});

describe('activeTab', () => {
	it('resolves the active tab within a role', () => {
		expect(activeTab('admin', '/mobile-admin/admin')).toBe('home');
		expect(activeTab('admin', '/mobile-admin/admin/orders')).toBe('orders');
		expect(activeTab('coach', '/mobile-admin/coach')).toBe('today');
		expect(activeTab('coach', '/mobile-admin/coach/messages')).toBe('messages');
	});
});
