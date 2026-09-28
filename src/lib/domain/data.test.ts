/* src/lib/domain/data.test.ts — light invariants for the domain seed module
 *
 * R15(候選 F-3，誠實開機)：教練名單(見 $lib/domain/coaches)、班級/學員/訂單三個種子
 * 陣列(見 $lib/domain/classes、members、orders)、已刪除的 $lib/domain/shared 分館
 * 常數，四組 seed 值已退役(唯一消費者 mobile-admin 的誠實開機),對應的 canary 一併
 * 移除。VENUES/TICKETS 仍是活種子，保留(LEVELS 的釘已在 course-level.test.ts 覆蓋，
 * 本檔原本沒有它自己的 canary)。 */
import { describe, it, expect } from 'vitest';
import { VENUES } from './venues';
import { TICKETS } from './tickets';

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
