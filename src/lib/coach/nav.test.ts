import { describe, it, expect } from 'vitest';
import { NAV, coachPath, isActive, resolve } from './nav';

describe('coachPath', () => {
	it('maps dashboard to the route root', () => {
		expect(coachPath('dashboard')).toBe('/coach');
	});
	it('maps every other id to /coach/<id>', () => {
		expect(coachPath('today')).toBe('/coach/today');
		expect(coachPath('attendance')).toBe('/coach/attendance');
		expect(coachPath('settings')).toBe('/coach/settings');
	});
});

describe('isActive', () => {
	it('keeps the root (儀表板) active only on an exact match', () => {
		expect(isActive('/coach', '/coach')).toBe(true);
		expect(isActive('/coach', '/coach/today')).toBe(false);
		expect(isActive('/coach', '/coach/students')).toBe(false);
	});
	it('activates deeper links by prefix', () => {
		expect(isActive('/coach/today', '/coach/today')).toBe(true);
		expect(isActive('/coach/students', '/coach/students')).toBe(true);
		expect(isActive('/coach/messages', '/coach/today')).toBe(false);
	});
});

describe('resolve', () => {
	it('returns crumb + title for the root', () => {
		expect(resolve('/coach')).toEqual(['首頁 / 儀表板', '教練儀表板']);
	});
	it('returns crumb + title for deeper routes (點名 for attendance)', () => {
		expect(resolve('/coach/attendance')).toEqual(['首頁 / 出勤記錄', '點名']);
		expect(resolve('/coach/messages')).toEqual(['首頁 / 訊息中心', '訊息中心']);
	});
	it('falls back to the dashboard meta for unknown paths', () => {
		expect(resolve('/coach/nope')).toEqual(['首頁 / 儀表板', '教練儀表板']);
	});
});

describe('NAV', () => {
	it('has 7 items with a badge only on 訊息中心', () => {
		expect(NAV).toHaveLength(7);
		const badged = NAV.filter((n) => n.badge != null);
		expect(badged).toHaveLength(1);
		expect(badged[0].id).toBe('messages');
		expect(badged[0].badge).toBe(3);
	});
});
