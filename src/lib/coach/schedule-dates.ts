/* Dream Fly — 教練端 排課管理 · date helpers for the interactive calendar.
 *
 * SCHED_COURSES.day uses 'Mon'..'Sun', but Date.getDay() is Sunday-zero
 * ('Sun'=0). `dayKey` bridges the two; everything else is Monday-leading to
 * match the existing SCHED_DAYS / ScheduleGrid layout. */

const KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Monday-leading order, with the zh label used by SCHED_DAYS. */
const WEEK: Array<{ key: string; zh: string }> = [
	{ key: 'Mon', zh: '一' },
	{ key: 'Tue', zh: '二' },
	{ key: 'Wed', zh: '三' },
	{ key: 'Thu', zh: '四' },
	{ key: 'Fri', zh: '五' },
	{ key: 'Sat', zh: '六' },
	{ key: 'Sun', zh: '日' }
];

/** The prototype's fixed "current day". The 今日 highlight stays pinned here, so
 * prev/next navigation never re-labels the navigated-to anchor (e.g. 5/23, 6/6) as today. */
const PROTO_TODAY = new Date(2026, 4, 30); // Sat 30 May 2026

/** SCHED_COURSES.day key for a Date (NOT Sunday-zero — Sat→'Sat'). */
export function dayKey(date: Date): string {
	return KEYS[date.getDay()];
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
	const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
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
 * equal to the fixed `todayRef` (the prototype current day) — NOT the anchor — so
 * navigating weeks doesn't drag the 今日 highlight along. Shape mirrors SCHED_DAYS
 * so ScheduleGrid renders identically. */
export function weekDays(anchor: Date, todayRef: Date = PROTO_TODAY): WeekDayCell[] {
	const mon = weekMonday(anchor);
	return WEEK.map((w, i) => {
		const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
		return {
			key: w.key,
			zh: w.zh,
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
export function monthMatrix(anchor: Date, todayRef: Date = PROTO_TODAY): MonthCell[] {
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

const ZH_WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/** e.g. 2026年5月 */
export function fmtMonthTitle(anchor: Date): string {
	return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`;
}

/** e.g. 5月30日 星期六 */
export function fmtDayTitle(anchor: Date): string {
	return `${anchor.getMonth() + 1}月${anchor.getDate()}日 星期${ZH_WEEK[anchor.getDay()]}`;
}
