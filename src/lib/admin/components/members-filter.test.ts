import { describe, it, expect } from 'vitest';
import { MEMBERS } from '$lib/admin/data';
import { filterMembers, countByStatus } from './members-filter';

/* Pure filter/sort derivation for the 學員名單 (ported from admin.jsx
 * MembersTable). Exercised against the real MEMBERS fixture so the behaviour is
 * pinned to production data, no rendering required. */
describe('filterMembers', () => {
	it('empty query + all status returns every row (a fresh array, not the input ref)', () => {
		const out = filterMembers(MEMBERS, { query: '', status: 'all' });
		expect(out).toHaveLength(MEMBERS.length);
		expect(out).not.toBe(MEMBERS);
	});

	it('defaults (no opts) return every row', () => {
		expect(filterMembers(MEMBERS)).toHaveLength(MEMBERS.length);
	});

	it('matches by name', () => {
		const out = filterMembers(MEMBERS, { query: '王承恩' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.name.includes('王承恩'))).toBe(true);
	});

	it('matches by id (case-insensitive)', () => {
		const target = MEMBERS[0];
		const out = filterMembers(MEMBERS, { query: target.id.toLowerCase() });
		expect(out.map((m) => m.id)).toContain(target.id);
		expect(out).toHaveLength(1);
	});

	it('matches by course substring', () => {
		const out = filterMembers(MEMBERS, { query: '跑酷' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.course.includes('跑酷'))).toBe(true);
	});

	it('non-matching query returns nothing', () => {
		expect(filterMembers(MEMBERS, { query: '___no-such-member___' })).toHaveLength(0);
	});

	it('status filter narrows to that status only', () => {
		const warning = filterMembers(MEMBERS, { status: 'warning' });
		expect(warning.length).toBeGreaterThan(0);
		expect(warning.every((m) => m.status === 'warning')).toBe(true);
		const paused = filterMembers(MEMBERS, { status: 'paused' });
		expect(paused.every((m) => m.status === 'paused')).toBe(true);
		// the three status slices partition the full set
		const active = filterMembers(MEMBERS, { status: 'active' });
		expect(active.length + warning.length + paused.length).toBe(MEMBERS.length);
	});

	it('status + query compose (search applies within the tab)', () => {
		const out = filterMembers(MEMBERS, { status: 'active', query: '林' });
		expect(out.every((m) => m.status === 'active' && (m.name + m.id + m.course).includes('林'))).toBe(
			true
		);
	});

	it('sort by att descending orders rows high→low', () => {
		const out = filterMembers(MEMBERS, { sort: { key: 'att', dir: 'desc' } });
		expect(out).toHaveLength(MEMBERS.length);
		for (let i = 1; i < out.length; i++) {
			expect(out[i - 1].att).toBeGreaterThanOrEqual(out[i].att);
		}
	});

	it('sort by att ascending orders rows low→high', () => {
		const out = filterMembers(MEMBERS, { sort: { key: 'att', dir: 'asc' } });
		for (let i = 1; i < out.length; i++) {
			expect(out[i - 1].att).toBeLessThanOrEqual(out[i].att);
		}
	});

	it('sort never mutates the input array', () => {
		const before = MEMBERS.map((m) => m.id);
		filterMembers(MEMBERS, { sort: { key: 'att', dir: 'desc' } });
		expect(MEMBERS.map((m) => m.id)).toEqual(before);
	});

	it('null sort key keeps source order', () => {
		const out = filterMembers(MEMBERS, { sort: { key: null, dir: 'desc' } });
		expect(out.map((m) => m.id)).toEqual(MEMBERS.map((m) => m.id));
	});
});

describe('countByStatus', () => {
	it('counts each status and the total', () => {
		const c = countByStatus(MEMBERS);
		expect(c.all).toBe(MEMBERS.length);
		expect(c.active).toBe(MEMBERS.filter((m) => m.status === 'active').length);
		expect(c.warning).toBe(MEMBERS.filter((m) => m.status === 'warning').length);
		expect(c.paused).toBe(MEMBERS.filter((m) => m.status === 'paused').length);
		expect(c.active + c.warning + c.paused).toBe(c.all);
	});
});
