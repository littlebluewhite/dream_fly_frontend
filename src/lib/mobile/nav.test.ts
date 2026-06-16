import { describe, it, expect } from 'vitest';
import { TABS, mobilePath, isActive, activeTab } from './nav';

describe('mobilePath', () => {
	it('maps the home tab to the surface root', () => {
		expect(mobilePath('home')).toBe('/mobile');
	});
	it('maps every other tab to /mobile/<id>', () => {
		expect(mobilePath('courses')).toBe('/mobile/courses');
		expect(mobilePath('mine')).toBe('/mobile/mine');
		expect(mobilePath('account')).toBe('/mobile/account');
	});
});

describe('isActive', () => {
	it('keeps home (/mobile) active only on an exact match', () => {
		expect(isActive('/mobile', '/mobile')).toBe(true);
		expect(isActive('/mobile', '/mobile/courses')).toBe(false);
	});
	it('activates deeper tabs by prefix', () => {
		expect(isActive('/mobile/courses', '/mobile/courses')).toBe(true);
		expect(isActive('/mobile/mine', '/mobile/courses')).toBe(false);
	});
});

describe('activeTab', () => {
	it('resolves the active tab id from a pathname', () => {
		expect(activeTab('/mobile')).toBe('home');
		expect(activeTab('/mobile/courses')).toBe('courses');
		expect(activeTab('/mobile/notifications')).toBe('notifications');
	});
	it('stays on the owning tab when an overlay deepens the path', () => {
		expect(activeTab('/mobile/mine/anything')).toBe('mine');
	});
	it('falls back to home for unknown paths', () => {
		expect(activeTab('/mobile/nope')).toBe('home');
	});
});

describe('TABS', () => {
	it('lists the 5 member tabs in order', () => {
		expect(TABS.map((t) => t.id)).toEqual(['home', 'courses', 'mine', 'notifications', 'account']);
	});
});
