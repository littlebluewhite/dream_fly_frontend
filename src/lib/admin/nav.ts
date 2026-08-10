/* Dream Fly — 管理後台 · navigation model (single source of truth).
 *
 * NAV previously lived in Sidebar's module-context script; TITLES + the
 * longest-prefix resolve() previously lived in the admin +layout. Both are
 * consolidated here (shape mirrors coach/nav.ts) so Sidebar and the layout
 * share one source, unit-tested in nav.test.ts. Sidebar's NAV labels and
 * TITLES' labels disagree in a few spots (e.g. 會員管理 vs 學員管理) — a
 * pre-existing divergence, preserved verbatim rather than unified. */

import type { IconName } from '$lib/icon-registry';

export const NAV: { href: string; label: string; icon: IconName }[] = [
	{ href: '/admin', label: '儀表板總覽', icon: 'layout-dashboard' },
	{ href: '/admin/members', label: '會員管理', icon: 'users' },
	{ href: '/admin/coaches', label: '教練管理', icon: 'user-check' },
	{ href: '/admin/classes', label: '課程管理', icon: 'book-open' },
	{ href: '/admin/orders', label: '訂單管理', icon: 'shopping-bag' },
	{ href: '/admin/coupons', label: '優惠碼管理', icon: 'percent' },
	{ href: '/admin/venues', label: '場館管理', icon: 'building-2' },
	{ href: '/admin/tickets', label: '票券管理', icon: 'ticket' },
	{ href: '/admin/reports', label: '報表分析', icon: 'bar-chart-3' },
	{ href: '/admin/settings', label: '系統設定', icon: 'settings' }
];

/* Active-state rule, extracted as a pure function so it can be unit-tested
 * without mocking `$page`. The dashboard (`/admin`) is active ONLY on the
 * exact root path; every other item matches by prefix. */
export function isActive(href: string, path: string): boolean {
	return href === '/admin' ? path === '/admin' : path.startsWith(href);
}

const TITLES: Record<string, [string, string]> = {
	'/admin': ['營運總覽', '全館即時概況'],
	'/admin/members': ['學員管理', '報名與出席'],
	'/admin/coaches': ['教練團隊', '專任教練'],
	'/admin/classes': ['課程管理', '班級與招生'],
	'/admin/orders': ['訂單與金流', '繳費紀錄'],
	'/admin/coupons': ['優惠碼管理', '折扣代碼與使用期限'],
	'/admin/venues': ['場館管理', '場地與器材'],
	'/admin/tickets': ['票券管理', '方案與銷售'],
	'/admin/reports': ['報表分析', '營運數據概覽'],
	'/admin/settings': ['系統設定', '場館與權限']
};

/* Longest-prefix match: '/admin' matches only exactly, deeper routes match
 * by prefix and the most specific key wins. */
export function resolve(path: string): [string, string] {
	let best: [string, string] = ['營運總覽', '全館即時概況'];
	let bestLen = -1;
	for (const [href, meta] of Object.entries(TITLES)) {
		const hit = href === '/admin' ? path === '/admin' : path.startsWith(href);
		if (hit && href.length > bestLen) {
			best = meta;
			bestLen = href.length;
		}
	}
	return best;
}
