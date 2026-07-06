/* Dream Fly — 教練端 · navigation model (single source of truth).
 *
 * The prototype switched views via `setView(id)`. Rendered as real routes, the
 * dashboard lives at the route ROOT (`/coach`, not `/coach/dashboard`), so
 * `coachPath` special-cases it. NAV / coachPath / isActive / resolve are shared
 * by Sidebar, Topbar, ProfileMenu, NotifMenu and the layout title map. Pure
 * functions, unit-tested in nav.test.ts. Ported from shell.jsx NAV + PAGES. */

export interface CoachNav {
	id: string;
	label: string;
	icon: string;
	badge?: number;
}

/* 8 flat nav items (shell.jsx:7-15 + Task 11's 請假審核). Badge only on 訊息中心
 * (faithful). 請假審核 sits next to 出勤記錄 — both are attendance-adjacent
 * concerns (a leave request writes an attendance record on approval, §3.20). */
export const NAV: CoachNav[] = [
	{ id: 'dashboard', label: '儀表板', icon: 'layout-dashboard' },
	{ id: 'today', label: '今日課程', icon: 'calendar-clock' },
	{ id: 'students', label: '我的學員', icon: 'users' },
	{ id: 'schedule', label: '排課管理', icon: 'calendar-days' },
	{ id: 'attendance', label: '出勤記錄', icon: 'clipboard-check' },
	{ id: 'leave-requests', label: '請假審核', icon: 'calendar-off' },
	{ id: 'messages', label: '訊息中心', icon: 'message-circle', badge: 3 },
	{ id: 'settings', label: '個人設定', icon: 'settings' }
];

/** Map a prototype view id to its real route. dashboard → root; else /coach/<id>. */
export function coachPath(id: string): string {
	return id === 'dashboard' ? '/coach' : `/coach/${id}`;
}

/** Sidebar active-state rule (mirrors admin): the root link is active only on an
 *  exact match, so 儀表板 does not stay always-active on deeper routes. */
export function isActive(href: string, path: string): boolean {
	return href === '/coach' ? path === '/coach' : path.startsWith(href);
}

/* breadcrumb + title per route (shell.jsx:17-25, keyed by real path). */
const TITLES: Record<string, [string, string]> = {
	'/coach': ['首頁 / 儀表板', '教練儀表板'],
	'/coach/today': ['首頁 / 今日課程', '今日課程'],
	'/coach/students': ['首頁 / 我的學員', '我的學員'],
	'/coach/schedule': ['首頁 / 排課管理', '排課管理'],
	'/coach/attendance': ['首頁 / 出勤記錄', '點名'],
	'/coach/leave-requests': ['首頁 / 請假審核', '請假審核'],
	'/coach/messages': ['首頁 / 訊息中心', '訊息中心'],
	'/coach/settings': ['首頁 / 個人設定', '個人設定']
};

/** Longest-prefix match (admin pattern): '/coach' matches only exactly; deeper
 *  routes match by prefix, most specific key wins. */
export function resolve(path: string): [string, string] {
	let best: [string, string] = TITLES['/coach'];
	let bestLen = -1;
	for (const [href, meta] of Object.entries(TITLES)) {
		const hit = href === '/coach' ? path === '/coach' : path.startsWith(href);
		if (hit && href.length > bestLen) {
			best = meta;
			bestLen = href.length;
		}
	}
	return best;
}
