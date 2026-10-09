/* Dream Fly — 教練端 排課管理 · date helpers for the interactive calendar.
 *
 * SCHED_COURSES.day uses 'Mon'..'Sun', but Date.getDay() is Sunday-zero
 * ('Sun'=0). `dayKey` bridges the two; everything else is Monday-leading to
 * match the existing SCHED_DAYS / ScheduleGrid layout. */

import { DAY_KEYS, WEEKDAY_ZH, toWeekColumn } from '$lib/domain/weekday';

/** SCHED_COURSES.day key for a Date (NOT Sunday-zero — Sat→'Sat'). */
export function dayKey(date: Date): string {
	return DAY_KEYS[date.getDay()];
}

/** Same calendar day (local) — ignores time. */
function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Monday that opens the week containing `date`. */
function weekMonday(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dow = d.getDay(); // 0=Sun
	const diff = -toWeekColumn(dow); // back to Monday
	d.setDate(d.getDate() + diff);
	return d;
}

export interface WeekDayCell {
	key: string;
	zh: string;
	date: string; // 'M/D'
	today: boolean;
}

/** 7 Monday-leading cells for the anchor's week. `today` is true only for the cell
 * equal to `todayRef` (defaults to the real current date) — NOT the anchor — so
 * navigating weeks doesn't drag the 今日 highlight along. Shape mirrors SCHED_DAYS
 * so ScheduleGrid renders identically. */
export function weekDays(anchor: Date, todayRef: Date = new Date()): WeekDayCell[] {
	const mon = weekMonday(anchor);
	return Array.from({ length: 7 }, (_, i) => {
		const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
		return {
			key: DAY_KEYS[d.getDay()],
			zh: WEEKDAY_ZH[d.getDay()],
			date: `${d.getMonth() + 1}/${d.getDate()}`,
			today: sameDay(d, todayRef)
		};
	});
}

export interface MonthCell {
	date: Date;
	inMonth: boolean;
	key: string;
	today: boolean;
}

/** 6×7 = 42 Monday-leading cells covering the anchor's month. */
export function monthMatrix(anchor: Date, todayRef: Date = new Date()): MonthCell[] {
	const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
	const start = weekMonday(first); // grid origin (may be in prev month)
	const cells: MonthCell[] = [];
	for (let i = 0; i < 42; i++) {
		const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
		cells.push({
			date: d,
			inMonth: d.getMonth() === anchor.getMonth(),
			key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
			today: sameDay(d, todayRef)
		});
	}
	return cells;
}

/** Shift the anchor by one step of the given view. 週 ±7d, 日 ±1d, 月 ±1 month.
 * Month shift normalises the day to 1 first so a 31-day month never overflows
 * (Jan 31 +1 → Feb 1, never Mar 3). */
export function shiftAnchor(anchor: Date, view: '日' | '週' | '月', dir: -1 | 1): Date {
	if (view === '月') {
		return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
	}
	const step = view === '週' ? 7 : 1;
	return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dir * step);
}

/** e.g. 2026年5月 */
export function fmtMonthTitle(anchor: Date): string {
	return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
}

/** e.g. 5月30日 星期六 */
export function fmtDayTitle(anchor: Date): string {
	return `${anchor.getMonth() + 1}月${anchor.getDate()}日 星期${WEEKDAY_ZH[anchor.getDay()]}`;
}

/** e.g. 2026年5月30日 星期六 — the label coach/api.ts's getDashboard/getToday attach
 * to the real current date (real API, so "today" must track the clock, not a
 * fixed prototype day). */
export function todayLabel(d: Date = new Date()): string {
	return `${d.getFullYear()}年${fmtDayTitle(d)}`;
}
