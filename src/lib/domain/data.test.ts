/* src/lib/domain/data.test.ts — light invariants for the domain seed module */
import { describe, it, expect } from 'vitest';
import { COACHES } from './coaches';
import { CLASSES_BASE } from './classes';
import { MEMBERS_BASE } from './members';
import { ORDERS_BASE } from './orders';
import { CAMPUSES, ENROLL_SOURCES } from './shared';

/* ── row-count canaries ── */
describe('row counts', () => {
	it('COACHES has 9 rows', () => expect(COACHES).toHaveLength(9));
	it('CLASSES_BASE has 22 rows', () => expect(CLASSES_BASE).toHaveLength(22));
	it('MEMBERS_BASE has 48 rows', () => expect(MEMBERS_BASE).toHaveLength(48));
	it('ORDERS_BASE has 36 rows', () => expect(ORDERS_BASE).toHaveLength(36));
});

/* ── id uniqueness ── */
describe('id uniqueness', () => {
	it('COACHES ids are unique', () => {
		const ids = COACHES.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('CLASSES_BASE ids are unique', () => {
		const ids = CLASSES_BASE.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('MEMBERS_BASE ids are unique', () => {
		const ids = MEMBERS_BASE.map((m) => m.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('ORDERS_BASE ids are unique', () => {
		const ids = ORDERS_BASE.map((o) => o.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

/* ── enum membership ── */
describe('enum membership', () => {
	const coachStatuses = new Set(['online', 'busy', 'offline']);
	const levels = new Set(['啟蒙', '入門', '基礎', '進階', '選手']);
	const classStatuses = new Set(['招生中', '候補', '額滿']);
	const memberStatuses = new Set(['active', 'warning', 'paused']);
	const payStatuses = new Set(['paid', 'due', 'trial']);
	const attMarks = new Set(['p', 'a', 'l', 'v']);
	const orderStatuses = new Set(['paid', 'pending', 'refunded']);

	it('every COACHES[i].status is a valid CoachStatus', () => {
		COACHES.forEach((c) => expect(coachStatuses.has(c.status)).toBe(true));
	});
	it('every CLASSES_BASE[i].level is a valid Level', () => {
		CLASSES_BASE.forEach((k) => expect(levels.has(k.level)).toBe(true));
	});
	it('every CLASSES_BASE[i].status is a valid ClassStatus', () => {
		CLASSES_BASE.forEach((k) => expect(classStatuses.has(k.status)).toBe(true));
	});
	it('every MEMBERS_BASE[i].status is a valid MemberStatus', () => {
		MEMBERS_BASE.forEach((m) => expect(memberStatuses.has(m.status)).toBe(true));
	});
	it('every MEMBERS_BASE[i].pay is a valid PayStatus', () => {
		MEMBERS_BASE.forEach((m) => expect(payStatuses.has(m.pay)).toBe(true));
	});
	it('every MEMBERS_BASE[i].recent entry is a valid AttMark', () => {
		MEMBERS_BASE.forEach((m) => m.recent.forEach((r) => expect(attMarks.has(r)).toBe(true)));
	});
	it('every ORDERS_BASE[i].status is a valid OrderStatus', () => {
		ORDERS_BASE.forEach((o) => expect(orderStatuses.has(o.status)).toBe(true));
	});
});

/* ── required string fields non-empty ── */
describe('required string fields non-empty', () => {
	it('all COACHES have non-empty id and name', () => {
		COACHES.forEach((c) => {
			expect(c.id.length).toBeGreaterThan(0);
			expect(c.name.length).toBeGreaterThan(0);
		});
	});
	it('all CLASSES_BASE have non-empty id and name', () => {
		CLASSES_BASE.forEach((k) => {
			expect(k.id.length).toBeGreaterThan(0);
			expect(k.name.length).toBeGreaterThan(0);
		});
	});
	it('all MEMBERS_BASE have non-empty id and name', () => {
		MEMBERS_BASE.forEach((m) => {
			expect(m.id.length).toBeGreaterThan(0);
			expect(m.name.length).toBeGreaterThan(0);
		});
	});
	it('all ORDERS_BASE have non-empty id and member', () => {
		ORDERS_BASE.forEach((o) => {
			expect(o.id.length).toBeGreaterThan(0);
			expect(o.member.length).toBeGreaterThan(0);
		});
	});
});

/* ── shared constants ── */
describe('shared constants', () => {
	it('CAMPUSES has exactly 3 non-empty strings', () => {
		expect(CAMPUSES).toHaveLength(3);
		CAMPUSES.forEach((s) => expect(s.length).toBeGreaterThan(0));
	});
	it('ENROLL_SOURCES has exactly 6 non-empty strings', () => {
		expect(ENROLL_SOURCES).toHaveLength(6);
		ENROLL_SOURCES.forEach((s) => expect(s.length).toBeGreaterThan(0));
	});
});
