import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScheduleMonth from './ScheduleMonth.svelte';
import { monthMatrix } from '$lib/coach/schedule-dates';
import type { SchedCourse } from '$lib/coach/data';

// May 2026: 5 Saturdays (2,9,16,23,30), 4 Mondays — in-month.
const WEEKS = monthMatrix(new Date(2026, 4, 30));

const SAT_COURSE: SchedCourse = {
	day: 'Sat',
	start: '09:00',
	end: '10:00',
	name: '週末親子班',
	count: 12,
	cat: '體操',
	venue: '主場館'
};
const MON_COURSE: SchedCourse = {
	day: 'Mon',
	start: '09:00',
	end: '10:00',
	name: '幼兒體操初階',
	count: 8,
	cat: '體操',
	venue: '主場館'
};

describe('ScheduleMonth', () => {
	it('renders the weekday header (一…日)', () => {
		const { getByText } = render(ScheduleMonth, { weeks: WEEKS, courses: [] });
		for (const z of ['一', '二', '三', '四', '五', '六', '日']) {
			expect(getByText(z)).toBeInTheDocument();
		}
	});

	it('maps a Sat course onto every in-month Saturday cell (dayKey off-by-one guard)', () => {
		const { getAllByText } = render(ScheduleMonth, { weeks: WEEKS, courses: [SAT_COURSE] });
		// 5 in-month Saturdays in May 2026 → exactly 5 chips.
		expect(getAllByText('週末親子班')).toHaveLength(5);
	});

	it('maps a Mon course onto every in-month Monday cell (4 in May 2026)', () => {
		const { getAllByText } = render(ScheduleMonth, { weeks: WEEKS, courses: [MON_COURSE] });
		expect(getAllByText('幼兒體操初階')).toHaveLength(4);
	});

	it('renders the day-of-month number for in-month cells', () => {
		const { getAllByText } = render(ScheduleMonth, { weeks: WEEKS, courses: [] });
		// "30" appears once (May 30). getAllByText tolerates the cell text.
		expect(getAllByText('30').length).toBeGreaterThanOrEqual(1);
	});
});
