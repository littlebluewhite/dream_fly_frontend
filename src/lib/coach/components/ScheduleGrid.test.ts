import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ScheduleGrid from './ScheduleGrid.svelte';
import type { SchedCourse, SchedDay } from '$lib/coach/data';

/* ScheduleGrid is now prop-driven (days + courses), so day-view can pass a
 * single-day array and the week-view its 7 days, both off live filter state. */
const DAYS_WEEK: SchedDay[] = [
	{ key: 'Mon', zh: '一', date: '5/25' },
	{ key: 'Tue', zh: '二', date: '5/26' },
	{ key: 'Wed', zh: '三', date: '5/27' },
	{ key: 'Thu', zh: '四', date: '5/28' },
	{ key: 'Fri', zh: '五', date: '5/29' },
	{ key: 'Sat', zh: '六', date: '5/30', today: true },
	{ key: 'Sun', zh: '日', date: '5/31' }
];
const ONE_DAY: SchedDay[] = [{ key: 'Sat', zh: '六', date: '5/30', today: true }];

const COURSES: SchedCourse[] = [
	{ day: 'Sat', start: '09:00', end: '10:00' },
	{ day: 'Mon', start: '14:00', end: '15:00' }
];

describe('ScheduleGrid (prop-driven)', () => {
	it('renders one day header per element of the days prop (week = 7)', () => {
		const { getByText } = render(ScheduleGrid, { days: DAYS_WEEK, courses: COURSES });
		// every weekday zh label present
		for (const z of ['一', '二', '三', '四', '五', '六', '日']) {
			expect(getByText(z)).toBeInTheDocument();
		}
	});

	it('day-view passes a single day → renders only that day and its courses', () => {
		const { getByText, queryByText } = render(ScheduleGrid, { days: ONE_DAY, courses: COURSES });
		// Sat slot shows; Mon slot is filtered out because Mon isn't in `days`.
		expect(getByText('09:00-10:00')).toBeInTheDocument();
		expect(queryByText('14:00-15:00')).toBeNull();
	});

	it('respects the courses prop — an empty courses array renders no course blocks', () => {
		const { queryByText } = render(ScheduleGrid, { days: DAYS_WEEK, courses: [] });
		expect(queryByText('可授課時段')).toBeNull();
	});

	it('區塊標籤是字面值「可授課時段」(R16 Task 2a：SchedCourse 只有 day/start/end)', () => {
		const { getAllByText } = render(ScheduleGrid, { days: DAYS_WEEK, courses: COURSES });
		expect(getAllByText('可授課時段')).toHaveLength(2);
	});
});
