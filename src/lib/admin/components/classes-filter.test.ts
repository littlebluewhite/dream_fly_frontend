import { describe, it, expect } from 'vitest';
import { CLASSES, CATS } from '$lib/admin/data';
import { filterClasses } from './classes-filter';

/* Pure category + search derivation for 課程管理 (ported from admin.jsx
 * ClassesView). Exercised against the real CLASSES fixture so behaviour is
 * pinned to production data, no rendering required. */
describe('filterClasses', () => {
	it("'全部' (or default) returns every row, as a fresh array", () => {
		const out = filterClasses(CLASSES, { cat: '全部', query: '' });
		expect(out).toHaveLength(CLASSES.length);
		expect(out).not.toBe(CLASSES);
	});

	it('defaults (no opts) return every row', () => {
		expect(filterClasses(CLASSES)).toHaveLength(CLASSES.length);
	});

	it('a category narrows to rows in that category only', () => {
		const cat = CATS[0];
		const out = filterClasses(CLASSES, { cat });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((k) => k.cat === cat)).toBe(true);
		// strictly fewer than the full set (there is more than one category in the fixture)
		expect(out.length).toBeLessThan(CLASSES.length);
	});

	it('every category slice sums back to the full set', () => {
		const total = CATS.reduce((n, cat) => n + filterClasses(CLASSES, { cat }).length, 0);
		expect(total).toBe(CLASSES.length);
	});

	it('query matches by class name (case-insensitive)', () => {
		const out = filterClasses(CLASSES, { query: '跑酷' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((k) => k.name.includes('跑酷'))).toBe(true);
	});

	it('query matches by coach name', () => {
		const coach = '林雅婷';
		const out = filterClasses(CLASSES, { query: coach });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((k) => k.coach === coach)).toBe(true);
		// these matched on coach, not on the name text
		expect(out.some((k) => !k.name.includes(coach))).toBe(true);
	});

	it('category + query compose (search applies within the category)', () => {
		const cat = '競技體操';
		const out = filterClasses(CLASSES, { cat, query: '林雅婷' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((k) => k.cat === cat && (k.name + k.coach).includes('林雅婷'))).toBe(true);
	});

	it('non-matching query returns nothing', () => {
		expect(filterClasses(CLASSES, { query: '___no-such-class___' })).toHaveLength(0);
	});

	it('never mutates the input array', () => {
		const before = CLASSES.map((k) => k.id);
		filterClasses(CLASSES, { cat: '跑酷', query: '進階' });
		expect(CLASSES.map((k) => k.id)).toEqual(before);
	});
});
