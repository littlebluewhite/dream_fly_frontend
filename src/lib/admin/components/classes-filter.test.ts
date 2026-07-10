import { describe, it, expect } from 'vitest';
import { CATS, type ClassRow } from '$lib/admin/data';
import { filterClasses } from './classes-filter';

/* Pure category + search derivation for 課程管理 (ported from admin.jsx
 * ClassesView). Exercised against an inline fixture (Task 1, C2 死種子退役:
 * admin/data.ts 的 CLASSES 值已退役) spanning 4 distinct CATS categories, two
 * of them coached by 林雅婷 (in different categories, to exercise the
 * category+query compose case) so behaviour stays pinned to real domain data
 * shapes without rendering. */
const CLASSES: ClassRow[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週四', time: '19:00–20:30', enrolled: 11, cap: 12, age: '10–16 歲', price: 4800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16, startDate: '2026/03/01', checkinRate: 86, makeup: 0, durationMinutes: 90 },
	{ id: 'k2', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週一 / 週三', time: '17:30–18:30', enrolled: 8, cap: 10, age: '7–9 歲', price: 3200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16, startDate: '2026/03/02', checkinRate: 87, makeup: 1, durationMinutes: 90 },
	{ id: 'k5', name: '跑酷入門班', level: '入門', cat: '跑酷', coach: '王思齊', room: '戶外場', day: '週日', time: '15:00–16:30', enrolled: 7, cap: 10, age: '12 歲以上', price: 3400, status: '候補', wait: 2, term: '2026 春季', sessions: 12, startDate: '2026/03/05', checkinRate: 90, makeup: 2, durationMinutes: 90 },
	{ id: 'k6', name: '競技體操 選手班', level: '選手', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週五', time: '17:00–19:00', enrolled: 12, cap: 12, age: '8–14 歲', price: 6200, status: '額滿', wait: 4, term: '2026 春季', sessions: 20, startDate: '2026/03/06', checkinRate: 91, makeup: 0, durationMinutes: 90 }
];
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

	it('trims leading/trailing whitespace from the query before matching', () => {
		const out = filterClasses(CLASSES, { query: ' 跑酷 ' });
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
