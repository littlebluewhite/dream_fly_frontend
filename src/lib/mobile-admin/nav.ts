/* Dream Fly — 行動版後台 · navigation model (single source of truth).
 *
 * The prototype kept `role` (admin ⇄ coach) in React state, each role with its
 * own 5 tabs. Rendered as real routes, role becomes a path segment
 * (`/mobile-admin/admin/*`, `/mobile-admin/coach/*`) and each role's first tab
 * lives at the role ROOT. TABS / tabsFor / adminPath / isActive / roleFromPath /
 * activeTab are shared by the role layouts' TabBar. Pure, unit-tested in
 * nav.test.ts. Ported from ui.jsx ADMIN_TABS / COACH_TABS. */

import type { IconName } from '$lib/icon-registry';

export type Role = 'admin' | 'coach';

export interface AdminTab {
	id: string;
	label: string;
	icon: IconName;
}

/* admin bottom tabs (ui.jsx:96-102). */
export const ADMIN_TABS: AdminTab[] = [
	{ id: 'home', label: '總覽', icon: 'layout-dashboard' },
	{ id: 'members', label: '學員', icon: 'users' },
	{ id: 'classes', label: '課程', icon: 'book-open' },
	{ id: 'orders', label: '訂單', icon: 'shopping-bag' },
	{ id: 'more', label: '更多', icon: 'menu' }
];

/* coach bottom tabs (ui.jsx:103-109). */
export const COACH_TABS: AdminTab[] = [
	{ id: 'today', label: '工作台', icon: 'layout-dashboard' },
	{ id: 'attendance', label: '點名', icon: 'calendar-check' },
	{ id: 'students', label: '學員', icon: 'users' },
	{ id: 'messages', label: '訊息', icon: 'message-circle' },
	{ id: 'csettings', label: '設定', icon: 'settings' }
];

/** Each role's first tab — it lives at the role root, not /<id>. */
const ROOT_TAB: Record<Role, string> = { admin: 'home', coach: 'today' };

/** The tab set for a role. */
export function tabsFor(role: Role): AdminTab[] {
	return role === 'admin' ? ADMIN_TABS : COACH_TABS;
}

/** Map a (role, tab id) to its real route. First tab → role root; else
 *  /mobile-admin/<role>/<id>. */
export function adminPath(role: Role, id: string): string {
	const base = `/mobile-admin/${role}`;
	return id === ROOT_TAB[role] ? base : `${base}/${id}`;
}

/** TabBar active-state rule: a role root is active only on an exact match;
 *  deeper tabs match by prefix. */
export function isActive(href: string, path: string): boolean {
	return /^\/mobile-admin\/(admin|coach)$/.test(href) ? path === href : path.startsWith(href);
}

/** Extract the role segment from a path, or null (login / index have none). */
export function roleFromPath(path: string): Role | null {
	const seg = path.split('/')[2];
	return seg === 'admin' || seg === 'coach' ? seg : null;
}

/** Resolve which tab id owns a pathname within a role (longest-prefix match,
 *  role-root fallback). */
export function activeTab(role: Role, path: string): string {
	let best = ROOT_TAB[role];
	let bestLen = -1;
	for (const t of tabsFor(role)) {
		const href = adminPath(role, t.id);
		if (isActive(href, path) && href.length > bestLen) {
			best = t.id;
			bestLen = href.length;
		}
	}
	return best;
}
