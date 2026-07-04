import { describe, it, expect } from 'vitest';
import type { MemberAccount } from '$lib/admin/data';
import { filterMemberAccounts, countByAccountStatus } from './member-account-filter';

/* Pure filter/count derivation for the 學員管理 page's honest getMembers() table
 * (Task 5). Sibling to members-filter.ts, but keyed off MemberAccount (real
 * GET /users shape: id/name/initial/phone/joined/status/points) instead of the
 * mock Member type — no course/pay/attendance dimensions exist on this shape. */

const ROWS: MemberAccount[] = [
	{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250 },
	{ id: 'u2', name: '陳小華', initial: '陳', phone: '0922000111', joined: '2026-02-01', status: 'inactive', points: 0 },
	{ id: 'u3', name: '林小美', initial: '林', phone: '', joined: '2026-03-10', status: 'active', points: 300 }
];

describe('filterMemberAccounts', () => {
	it('empty query + all status returns every row (a fresh array, not the input ref)', () => {
		const out = filterMemberAccounts(ROWS, { query: '', status: 'all' });
		expect(out).toHaveLength(ROWS.length);
		expect(out).not.toBe(ROWS);
	});

	it('defaults (no opts) return every row', () => {
		expect(filterMemberAccounts(ROWS)).toHaveLength(ROWS.length);
	});

	it('matches by name', () => {
		const out = filterMemberAccounts(ROWS, { query: '王小明' });
		expect(out.map((m) => m.id)).toEqual(['u1']);
	});

	it('matches by id (case-insensitive)', () => {
		const out = filterMemberAccounts(ROWS, { query: 'U2' });
		expect(out.map((m) => m.id)).toEqual(['u2']);
	});

	it('matches by phone substring', () => {
		const out = filterMemberAccounts(ROWS, { query: '0912345678' });
		expect(out.map((m) => m.id)).toEqual(['u1']);
	});

	it('non-matching query returns nothing', () => {
		expect(filterMemberAccounts(ROWS, { query: '___no-such-member___' })).toHaveLength(0);
	});

	it('status = active narrows to active accounts only', () => {
		const out = filterMemberAccounts(ROWS, { status: 'active' });
		expect(out.every((m) => m.status === 'active')).toBe(true);
		expect(out).toHaveLength(2);
	});

	it('status = inactive narrows to inactive accounts only', () => {
		const out = filterMemberAccounts(ROWS, { status: 'inactive' });
		expect(out.map((m) => m.id)).toEqual(['u2']);
	});

	it('pointsMin is an inclusive lower bound', () => {
		const out = filterMemberAccounts(ROWS, { pointsMin: 300 });
		expect(out.every((m) => m.points >= 300)).toBe(true);
		expect(out.map((m) => m.id).sort()).toEqual(['u1', 'u3']);
	});

	it('undefined pointsMin is pass-through', () => {
		expect(filterMemberAccounts(ROWS, { pointsMin: undefined })).toHaveLength(ROWS.length);
	});

	it('status + pointsMin + query compose', () => {
		const out = filterMemberAccounts(ROWS, { status: 'active', pointsMin: 1000, query: '王' });
		expect(out.map((m) => m.id)).toEqual(['u1']);
	});

	it('never mutates the input array', () => {
		const before = ROWS.map((m) => m.id);
		filterMemberAccounts(ROWS, { status: 'active', pointsMin: 100, query: '林' });
		expect(ROWS.map((m) => m.id)).toEqual(before);
	});
});

describe('countByAccountStatus', () => {
	it('counts active/inactive and the total', () => {
		const c = countByAccountStatus(ROWS);
		expect(c.all).toBe(3);
		expect(c.active).toBe(2);
		expect(c.inactive).toBe(1);
		expect(c.active + c.inactive).toBe(c.all);
	});
});
