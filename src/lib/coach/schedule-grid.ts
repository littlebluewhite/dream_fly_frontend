/* Dream Fly — 教練端 排課管理 · schedule grid helpers.
 * SCHED_HOURS is NON-contiguous; Y is index-based, not clock-proportional. */

import { SCHED_HOURS } from '$lib/coach/data';

export const ROW_H = 64;

/** Index of the SCHED_HOURS slot whose HH matches t's HH. */
export function hourIdx(t: string): number {
	const hh = t.slice(0, 2);
	return SCHED_HOURS.findIndex((h) => h.slice(0, 2) === hh);
}

/** Y offset in pixels for a time string 'HH:MM'. */
export function toY(t: string): number {
	const minutes = parseInt(t.slice(3, 5));
	return ROW_H * (hourIdx(t) + minutes / 60);
}

/** Height in pixels spanning start→end. Clock-duration based (NOT toY(end)-toY(start)):
 * no course crosses the non-contiguous 11:00→14:00 gap, and an end time may fall one
 * hour past the last SCHED_HOURS slot (e.g. 17:00–18:00), which has no index. */
export function dur(start: string, end: string): number {
	const mins = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5));
	return ((mins(end) - mins(start)) / 60) * ROW_H;
}
