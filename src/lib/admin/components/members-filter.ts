/* Dream Fly — 管理後台 · 學員名單 filter/sort derivation.
 *
 * Pure, framework-free port of the React MembersTable body logic
 * (docs/design/admin/admin.jsx): filter by status tab, then by the topbar
 * search term (matches name OR id OR course, case-insensitive — the source
 * matches `m.name + m.id + m.course`), then optionally sort by 出席率 (att).
 * Kept here, unit-testable without rendering, and imported by MembersTable. */

import { CLASSES, COACHES, MEMBER_COLORS, type Member, type MemberStatus } from '$lib/admin/data';

/** Status tab/chip key. `all` = 全部; the rest mirror MemberStatus. */
export type MemberStatusFilter = 'all' | MemberStatus;

/** Sort directive: only 出席率 (att) is sortable in the source, or null = source order. */
export interface MembersSort {
	key: 'att' | null;
	dir: 'asc' | 'desc';
}

export interface MembersFilter {
	/** Topbar search term; matched against name + id + course, case-insensitive. */
	query?: string;
	/** Status tab/chip. Defaults to 'all'. */
	status?: MemberStatusFilter;
	/** Sort by att; omitted/null keeps source order. */
	sort?: MembersSort;
}

/** Per-status counts for the tab badges (全部 / 在學中 / 出席偏低 / 暫停中). */
export interface MemberCounts {
	all: number;
	active: number;
	warning: number;
	paused: number;
}

/** Tally the four tab counts off the full row set (counts ignore query/sort). */
export function countByStatus(rows: Member[]): MemberCounts {
	return {
		all: rows.length,
		active: rows.filter((m) => m.status === 'active').length,
		warning: rows.filter((m) => m.status === 'warning').length,
		paused: rows.filter((m) => m.status === 'paused').length
	};
}

/**
 * Filter + sort the learner rows. Order mirrors the source: status tab →
 * search term → sort. Returns a new array; the input is never mutated.
 */
export function filterMembers(rows: Member[], opts: MembersFilter = {}): Member[] {
	const { query = '', status = 'all', sort } = opts;

	let out = status === 'all' ? rows : rows.filter((m) => m.status === status);

	const q = query.trim().toLowerCase();
	if (q) {
		out = out.filter((m) => (m.name + m.id + m.course).toLowerCase().includes(q));
	}

	if (sort?.key) {
		const get = (m: Member) => m[sort.key as 'att'];
		out = [...out].sort((a, b) => (sort.dir === 'desc' ? get(b) - get(a) : get(a) - get(b)));
	} else if (out === rows) {
		// never hand back the caller's array reference unsliced/unsorted
		out = [...rows];
	}

	return out;
}

/**
 * A fresh blank learner for the 新增學員 flow. `seq` (the current row count)
 * yields a unique, monotonic member id so the keyed table never collides when
 * several members are added in a row. Mirrors admin.jsx blankMember defaults.
 */
export function blankMember(seq: number): Member {
	return {
		id: 'GY' + String(2024001 + seq),
		name: '',
		initial: '',
		color: MEMBER_COLORS[seq % MEMBER_COLORS.length],
		course: CLASSES[0].name,
		coach: COACHES[0].name,
		att: 100,
		status: 'active',
		age: 0,
		parent: '',
		phone: '',
		joined: '2026/06',
		points: 0,
		pay: 'trial',
		remain: 0,
		lastSeen: '—',
		recent: [],
		emName: '',
		emPhone: '',
		campus: '美村本館',
		source: '官網預約表單',
		birthday: '—',
		tier: '一般會員',
		tierColor: '#64748B',
		renewDue: '體驗 06/30 到期',
		lineId: ''
	};
}
