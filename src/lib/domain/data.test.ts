/* src/lib/domain/data.test.ts — light invariants for the domain seed module */
import { describe, it, expect } from 'vitest';
import { COACHES } from './coaches';
import { CLASSES_BASE } from './classes';
import { MEMBERS_BASE } from './members';
import { ORDERS_BASE } from './orders';
import { CAMPUSES } from './shared';
import { VENUES } from './venues';
import { TICKETS } from './tickets';
import { LEVELS } from './course-level';

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
	const levels = new Set(LEVELS);
	const classStatuses = new Set(['招生中', '候補', '額滿']);
	const memberStatuses = new Set(['active', 'warning', 'paused']);
	const payStatuses = new Set(['paid', 'due', 'trial']);
	const attMarks = new Set(['p', 'a', 'l', 'v']);
	const orderStatuses = new Set(['paid', 'pending', 'refunded']);

	it('every COACHES[i].isActive is a boolean', () => {
		COACHES.forEach((c) => expect(typeof c.isActive).toBe('boolean'));
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
});

/* ── new dataset row counts ── */
describe('new dataset row counts', () => {
	it('VENUES has 6 rows', () => expect(VENUES).toHaveLength(6));
	it('TICKETS has 6 rows', () => expect(TICKETS).toHaveLength(6));
});

/* ── new dataset id uniqueness ── */
describe('new dataset id uniqueness', () => {
	it('VENUES ids are unique', () => {
		const ids = VENUES.map((v) => v.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
	it('TICKETS ids are unique', () => {
		const ids = TICKETS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

/* ── new dataset enum membership ── */
describe('new dataset enum membership', () => {
	const venueStatuses = new Set(['available', 'maintenance']);
	const ticketTypes = new Set(['ticket', 'membership', 'course_package']);

	it('every VENUES[i].status is valid', () => {
		VENUES.forEach((v) => expect(venueStatuses.has(v.status)).toBe(true));
	});
	it('every TICKETS[i].type is valid', () => {
		TICKETS.forEach((t) => expect(ticketTypes.has(t.type)).toBe(true));
	});
});

/* ── new datasets non-empty ── */
describe('new datasets non-empty', () => {
	it('all new arrays are non-empty', () => {
		for (const arr of [VENUES, TICKETS]) {
			expect(arr.length).toBeGreaterThan(0);
		}
	});
});
