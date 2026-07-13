/* Dream Fly — 行動版會員 App · navigation model (single source of truth).
 *
 * The prototype switched tabs via `setTab(id)`. Rendered as real routes, the
 * home tab lives at the surface ROOT (`/mobile`, not `/mobile/home`), so
 * `mobilePath` special-cases it. TABS / mobilePath / isActive / activeTab are
 * shared by the layout TabBar. Pure functions, unit-tested in nav.test.ts.
 * Ported from ui.jsx TABS. */

import type { IconName } from '$lib/icon-registry';

export interface MobileTab {
	id: string;
	label: string;
	icon: IconName;
}

/* 5 bottom tabs (ui.jsx:64-70). */
export const TABS: MobileTab[] = [
	{ id: 'home', label: '首頁', icon: 'house' },
	{ id: 'courses', label: '課程', icon: 'graduation-cap' },
	{ id: 'mine', label: '我的課程', icon: 'calendar-check' },
	{ id: 'notifications', label: '通知', icon: 'bell' },
	{ id: 'account', label: '帳戶', icon: 'user-round' }
];

/** Map a tab id to its real route. home → surface root; else /mobile/<id>. */
export function mobilePath(id: string): string {
	return id === 'home' ? '/mobile' : `/mobile/${id}`;
}

/** TabBar active-state rule (mirrors coach): the root link is active only on an
 *  exact match, so 首頁 does not stay always-active on deeper tabs. */
export function isActive(href: string, path: string): boolean {
	return href === '/mobile' ? path === '/mobile' : path.startsWith(href);
}

/** Resolve which tab id owns a pathname (longest-prefix match, home fallback).
 *  Overlays never change the path, so a deepened path keeps its owning tab. */
export function activeTab(path: string): string {
	let best = 'home';
	let bestLen = -1;
	for (const t of TABS) {
		const href = mobilePath(t.id);
		if (isActive(href, path) && href.length > bestLen) {
			best = t.id;
			bestLen = href.length;
		}
	}
	return best;
}
