/* src/lib/domain/data.test.ts — light invariants for the domain seed module */
import { describe, it, expect } from 'vitest';
import { COACHES } from './coaches';
import { CLASSES_BASE } from './classes';
import { MEMBERS_BASE } from './members';
import { ORDERS_BASE } from './orders';
import { CAMPUSES, ENROLL_SOURCES } from './shared';
import { VENUES } from './venues';
import { TICKETS } from './tickets';
import { ACTIVITY } from './activity';
import {
	CATEGORY_SPLIT, TOP_COURSES, VENUE_USAGE,
	ATT_DIST, RETENTION, AGE_DIST, CAMPUS_REVENUE, PAYMENT_SPLIT, FUNNEL, WEEKDAY_LOAD, TIER_DIST,
	INCOME_SOURCES, COACH_PERF
} from './reports';

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

/* ── new dataset row counts ── */
describe('new dataset row counts', () => {
	it('VENUES has 6 rows', () => expect(VENUES).toHaveLength(6));
	it('TICKETS has 6 rows', () => expect(TICKETS).toHaveLength(6));
	it('ACTIVITY has 8 rows', () => expect(ACTIVITY).toHaveLength(8));
	it('CATEGORY_SPLIT has 4 rows', () => expect(CATEGORY_SPLIT).toHaveLength(4));
	it('TOP_COURSES has 5 rows', () => expect(TOP_COURSES).toHaveLength(5));
	it('VENUE_USAGE has 6 rows', () => expect(VENUE_USAGE).toHaveLength(6));
	it('ATT_DIST has 4 rows', () => expect(ATT_DIST).toHaveLength(4));
	it('RETENTION has 6 rows', () => expect(RETENTION).toHaveLength(6));
	it('AGE_DIST has 4 rows', () => expect(AGE_DIST).toHaveLength(4));
	it('CAMPUS_REVENUE has 3 rows', () => expect(CAMPUS_REVENUE).toHaveLength(3));
	it('PAYMENT_SPLIT has 5 rows', () => expect(PAYMENT_SPLIT).toHaveLength(5));
	it('FUNNEL has 4 rows', () => expect(FUNNEL).toHaveLength(4));
	it('WEEKDAY_LOAD has 7 rows', () => expect(WEEKDAY_LOAD).toHaveLength(7));
	it('TIER_DIST has 4 rows', () => expect(TIER_DIST).toHaveLength(4));
	it('INCOME_SOURCES has 4 rows', () => expect(INCOME_SOURCES).toHaveLength(4));
	it('COACH_PERF has 7 rows', () => expect(COACH_PERF).toHaveLength(7));
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
	const ticketTypes = new Set(['pass', 'trial', 'event']);

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
		for (const arr of [VENUES, TICKETS, ACTIVITY, CATEGORY_SPLIT, TOP_COURSES,
			VENUE_USAGE, ATT_DIST, RETENTION, AGE_DIST, CAMPUS_REVENUE,
			PAYMENT_SPLIT, FUNNEL, WEEKDAY_LOAD, TIER_DIST, INCOME_SOURCES, COACH_PERF]) {
			expect(arr.length).toBeGreaterThan(0);
		}
	});
});
