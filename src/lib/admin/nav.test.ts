import { describe, it, expect } from 'vitest';
import { NAV, isActive, resolve } from './nav';

describe('isActive', () => {
	it('root(儀表板總覽)僅在路徑完全相符時才判定為 active', () => {
		expect(isActive('/admin', '/admin')).toBe(true);
		expect(isActive('/admin', '/admin/members')).toBe(false);
		expect(isActive('/admin', '/admin/settings')).toBe(false);
	});
	it('更深層的連結以前綴判定 active,含巢狀子路徑', () => {
		expect(isActive('/admin/members', '/admin/members')).toBe(true);
		expect(isActive('/admin/members', '/admin/members/42')).toBe(true);
	});
	it('不會誤亮同層的其他模組', () => {
		expect(isActive('/admin/members', '/admin/coaches')).toBe(false);
		expect(isActive('/admin/orders', '/admin')).toBe(false);
	});
});

describe('resolve', () => {
	it('root 回傳對應的麵包屑與標題', () => {
		expect(resolve('/admin')).toEqual(['營運總覽', '全館即時概況']);
	});
	it('更深層路由回傳對應的麵包屑與標題', () => {
		expect(resolve('/admin/members')).toEqual(['學員管理', '報名與出席']);
		expect(resolve('/admin/settings')).toEqual(['系統設定', '場館與權限']);
	});
	it('巢狀子路由以最長前綴匹配', () => {
		expect(resolve('/admin/members/42')).toEqual(['學員管理', '報名與出席']);
	});
	it('未知路徑 fallback 回 root 的中繼資料', () => {
		expect(resolve('/admin/nope')).toEqual(['營運總覽', '全館即時概況']);
	});
});

describe('NAV', () => {
	it('共有 10 項', () => {
		expect(NAV).toHaveLength(10);
	});
	it('href 集合符合預期,依 Sidebar 原順序排列(防手滑漏搬)', () => {
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
