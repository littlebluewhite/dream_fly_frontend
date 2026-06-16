import { describe, it, expect } from 'vitest';
import { MEMBERS } from '$lib/admin/data';
import { filterMembers, countByStatus, blankMember } from './members-filter';

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

/* B3 advanced filter — course / pay / attMin / attMax. Each is an inclusive,
 * immutable narrowing whose default (omitted / '' / undefined) is pure
 * pass-through, so MembersTable's defaults stay equivalent to the old behaviour. */
describe('filterMembers — advanced fields (course / pay / attendance range)', () => {
	it('course = a specific 課程 narrows to exact-match rows only', () => {
		const course = '跑酷入門班';
		const out = filterMembers(MEMBERS, { course });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.course === course)).toBe(true);
	});

	it("course = '' (or 全部) is pass-through", () => {
		expect(filterMembers(MEMBERS, { course: '' })).toHaveLength(MEMBERS.length);
		expect(filterMembers(MEMBERS, { course: '全部' })).toHaveLength(MEMBERS.length);
	});

	it('pay = a specific 繳費狀態 narrows to that status only', () => {
		const out = filterMembers(MEMBERS, { pay: 'due' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.pay === 'due')).toBe(true);
	});

	it("pay = '' (or 'all') is pass-through", () => {
		expect(filterMembers(MEMBERS, { pay: '' })).toHaveLength(MEMBERS.length);
		expect(filterMembers(MEMBERS, { pay: 'all' })).toHaveLength(MEMBERS.length);
	});

	it('attMin is an inclusive lower bound', () => {
		const out = filterMembers(MEMBERS, { attMin: 90 });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.att >= 90)).toBe(true);
		// a member sitting exactly on the bound is kept
		const exact = MEMBERS.find((m) => m.att === 90);
		if (exact) expect(out.map((m) => m.id)).toContain(exact.id);
	});

	it('attMax is an inclusive upper bound', () => {
		const out = filterMembers(MEMBERS, { attMax: 75 });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((m) => m.att <= 75)).toBe(true);
	});

	it('attMin + attMax compose into an inclusive band', () => {
		const out = filterMembers(MEMBERS, { attMin: 80, attMax: 90 });
		expect(out.every((m) => m.att >= 80 && m.att <= 90)).toBe(true);
		// equals the hand-computed band
		const expected = MEMBERS.filter((m) => m.att >= 80 && m.att <= 90).length;
		expect(out).toHaveLength(expected);
	});

	it('undefined attMin/attMax are pass-through (full set, fresh array)', () => {
		const out = filterMembers(MEMBERS, { attMin: undefined, attMax: undefined });
		expect(out).toHaveLength(MEMBERS.length);
		expect(out).not.toBe(MEMBERS);
	});

	it('advanced fields compose with status + query', () => {
		const out = filterMembers(MEMBERS, {
			status: 'active',
			pay: 'paid',
			attMin: 90,
			query: '林'
		});
		expect(
			out.every(
				(m) =>
					m.status === 'active' &&
					m.pay === 'paid' &&
					m.att >= 90 &&
					(m.name + m.id + m.course).includes('林')
			)
		).toBe(true);
	});

	it('never mutates the input array', () => {
		const before = MEMBERS.map((m) => m.id);
		filterMembers(MEMBERS, { course: '跑酷入門班', pay: 'due', attMin: 70, attMax: 80 });
		expect(MEMBERS.map((m) => m.id)).toEqual(before);
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

/* P2 regression (codex round 1): the 新增學員 flow needs a blank member with a
 * unique id so it can be prepended to the keyed table without a key collision. */
describe('blankMember — 新增學員 add flow', () => {
	it('derives a unique, well-formed id from the current row count', () => {
		const m = blankMember(MEMBERS.length); // 48 seeded → GY2024049
		expect(m.id).toBe('GY2024049');
		expect(MEMBERS.some((x) => x.id === m.id)).toBe(false);
	});

	it('gives distinct ids for sequential adds (keyed-table safe)', () => {
		expect(blankMember(MEMBERS.length).id).not.toBe(blankMember(MEMBERS.length + 1).id);
	});

	it('seeds sane defaults with every required Member field populated', () => {
		const m = blankMember(0);
		expect(m.pay).toBe('trial');
		expect(m.status).toBe('active');
		expect(m.att).toBe(100);
		expect(m.course).toBeTruthy();
		expect(m.coach).toBeTruthy();
		expect(m.tier).toBe('一般會員');
	});
});
