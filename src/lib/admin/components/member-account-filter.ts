/* Dream Fly — 管理後台 · 學員管理頁（真實 GET /users 帳號）filter/count derivation.
 *
 * Pure, framework-free — sibling to members-filter.ts, but keyed off MemberAccount
 * (the honest getMembers() shape: id/name/initial/phone/joined/status/points) rather
 * than the mock Member type (which has course/campus/att/pay/tier… — no backend
 * source, see issue #8). Kept as a separate module so members-filter.ts (still used
 * by MembersTable's mock-backed compact dashboard preview) stays untouched. */

import type { MemberAccount, MemberAccountStatus } from '$lib/admin/data';

/** Status tab key. `all` = 全部; the rest mirror MemberAccountStatus. */
export type MemberAccountStatusFilter = 'all' | MemberAccountStatus;

export interface MemberAccountFilter {
	/** Topbar search term; matched against name + id + phone, case-insensitive. */
	query?: string;
	/** Status tab. Defaults to 'all'. */
	status?: MemberAccountStatusFilter;
	/** Advanced: inclusive 點數 lower bound. Omitted = no floor. */
	pointsMin?: number;
}

/** Per-status counts for the 全部/啟用中/已停用 tab badges. */
export interface MemberAccountCounts {
	all: number;
	active: number;
	inactive: number;
}

export function countByAccountStatus(rows: MemberAccount[]): MemberAccountCounts {
	return {
		all: rows.length,
		active: rows.filter((m) => m.status === 'active').length,
		inactive: rows.filter((m) => m.status === 'inactive').length
	};
}

/**
 * Filter the learner accounts. Order: status tab → 點數下限 → search term.
 * Returns a new array; the input is never mutated.
 */
export function filterMemberAccounts(
	rows: MemberAccount[],
	opts: MemberAccountFilter = {}
): MemberAccount[] {
	const { query = '', status = 'all', pointsMin } = opts;

	let out = status === 'all' ? rows : rows.filter((m) => m.status === status);

	if (pointsMin != null) {
		out = out.filter((m) => m.points >= pointsMin);
	}

	const q = query.trim().toLowerCase();
	if (q) {
		out = out.filter((m) => (m.name + m.id + m.phone).toLowerCase().includes(q));
	}

	// never hand back the caller's array reference unsliced
	if (out === rows) out = [...rows];

	return out;
}
