import { describe, it, expect } from 'vitest';
import {
	dayKey,
	weekDays,
	monthMatrix,
	shiftAnchor,
	fmtMonthTitle,
	fmtDayTitle
} from './schedule-dates';

// Reference anchor used by the page: Sat 30 May 2026 (getDay()===6).
const SAT = new Date(2026, 4, 30);

describe('dayKey', () => {
	it('maps a Saturday Date to "Sat" (NOT Sunday-zero off-by-one)', () => {
		expect(dayKey(SAT)).toBe('Sat');
	});
	it('maps a Sunday Date to "Sun"', () => {
		expect(dayKey(new Date(2026, 4, 31))).toBe('Sun');
	});
	it('maps a Monday Date to "Mon" (matches SCHED_COURSES.day vocabulary)', () => {
		expect(dayKey(new Date(2026, 4, 25))).toBe('Mon');
	});
});

describe('weekDays', () => {
	it('returns 7 cells, Monday-leading (Mon…Sun)', () => {
		const w = weekDays(SAT);
		expect(w).toHaveLength(7);
		expect(w.map((d) => d.key)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
	});
	it('formats date as M/D and leads with the anchor week Monday (5/25)', () => {
		const w = weekDays(SAT);
		expect(w[0].date).toBe('5/25');
		expect(w[5].date).toBe('5/30'); // the anchor (Sat)
		expect(w[6].date).toBe('5/31'); // Sun
	});
	it('carries the zh weekday label matching SCHED_DAYS', () => {
		const w = weekDays(SAT);
		expect(w.map((d) => d.zh)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
	});
	it('marks today true only for the fixed prototype today (5/30, the anchor here)', () => {
		const w = weekDays(SAT);
		const todays = w.filter((d) => d.today);
		expect(todays).toHaveLength(1);
		expect(todays[0].key).toBe('Sat');
	});
});

describe('today is fixed to the prototype current day (2026-05-30), not the anchor', () => {
	// codex round 2 P2: prev/next navigation moves the anchor, but the "today"
	// highlight + 今日 label must stay on 5/30 — not follow the anchor to 5/23 / 6/6.
	it('weekDays marks no cell as today when navigated to another week', () => {
		expect(weekDays(new Date(2026, 4, 23)).some((d) => d.today)).toBe(false); // prev week
		expect(weekDays(new Date(2026, 5, 6)).some((d) => d.today)).toBe(false); // next week
	});
	it('weekDays still highlights exactly 5/30 in the home week', () => {
		const todays = weekDays(SAT).filter((d) => d.today);
		expect(todays).toHaveLength(1);
		expect(todays[0].date).toBe('5/30');
	});
	it('monthMatrix marks no today in a month that does not contain 5/30', () => {
		expect(monthMatrix(new Date(2026, 5, 1)).some((c) => c.today)).toBe(false); // June
	});
});

describe('monthMatrix', () => {
	it('returns 42 cells (6×7), Monday-leading', () => {
		const m = monthMatrix(SAT);
		expect(m).toHaveLength(42);
	});
	it('flags inMonth correctly at the May 2026 boundaries (May 1 is a Fri)', () => {
		const m = monthMatrix(SAT);
		// May 1 2026 is Friday → Mon-leading first row is Apr 27..May 3.
		// index 0 = Apr 27 (out), index 4 = May 1 (in).
		expect(m[0].inMonth).toBe(false);
		expect(m[0].date.getDate()).toBe(27);
		expect(m[4].inMonth).toBe(true);
		expect(m[4].date.getMonth()).toBe(4); // May
		expect(m[4].date.getDate()).toBe(1);
	});
	it('every cell carries a string key and the fixed today (5/30) is flagged', () => {
		const m = monthMatrix(SAT);
		for (const c of m) expect(typeof c.key).toBe('string');
		const todays = m.filter((c) => c.today);
		expect(todays).toHaveLength(1);
		expect(todays[0].date.getDate()).toBe(30);
		expect(todays[0].date.getMonth()).toBe(4);
	});
});

describe('shiftAnchor', () => {
	it('週 ±7 days', () => {
		expect(shiftAnchor(SAT, '週', 1).getDate()).toBe(6); // +7 → Jun 6
		expect(shiftAnchor(SAT, '週', 1).getMonth()).toBe(5); // June
		expect(shiftAnchor(SAT, '週', -1).getDate()).toBe(23); // -7 → May 23
	});
	it('日 ±1 day', () => {
		expect(shiftAnchor(SAT, '日', 1).getDate()).toBe(31);
		expect(shiftAnchor(SAT, '日', -1).getDate()).toBe(29);
	});
	it('月 ±1 month without overflow at a 31-day boundary', () => {
		// Jan 31 + 1 month must land in February, never skip to March.
		const jan31 = new Date(2026, 0, 31);
		expect(shiftAnchor(jan31, '月', 1).getMonth()).toBe(1); // Feb
		// May → April going back.
		expect(shiftAnchor(SAT, '月', -1).getMonth()).toBe(3); // April
		expect(shiftAnchor(SAT, '月', 1).getMonth()).toBe(5); // June
	});
});

describe('title formatters', () => {
	it('fmtMonthTitle → 2026年5月', () => {
		expect(fmtMonthTitle(SAT)).toBe('2026年5月');
	});
	it('fmtDayTitle → 5月30日 星期六', () => {
		expect(fmtDayTitle(SAT)).toBe('5月30日 星期六');
	});
});
