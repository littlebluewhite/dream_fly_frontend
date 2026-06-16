import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SchedulePage from './+page.svelte';

/* 排課管理 page — now interactive: 日/週/月 toggle, prev/next/今日, and two
 * CoachDropdown filters (category + venue) that narrow the rendered courses.
 * Anchor is fixed at Sat 30 May 2026 so the rendered week is deterministic. */
describe('/coach/schedule (+page) — interactive', () => {
	it('defaults to the 週 view (time grid present) showing all courses', () => {
		const { container, getByText } = render(SchedulePage);
		const txt = container.textContent ?? '';
		// week grid renders SCHED_HOURS time labels; month view does not.
		expect(txt).toContain('08:00');
		// a Tue 啦啦隊 course and a Wed 跑酷 course are both visible unfiltered.
		expect(getByText('啦啦隊基礎')).toBeInTheDocument();
		expect(getByText('跑酷入門')).toBeInTheDocument();
	});

	it('switching to 月 swaps to the month view (time grid gone)', async () => {
		const { container, getByText } = render(SchedulePage);
		await fireEvent.click(getByText('月'));
		const txt = container.textContent ?? '';
		// month view has no SCHED_HOURS time column.
		expect(txt).not.toContain('08:00');
		// weekday header (一…日) still present.
		expect(getByText('一')).toBeInTheDocument();
	});

	it('a category filter narrows the rendered courses', async () => {
		const { getByText, queryByText, getAllByText } = render(SchedulePage);
		// open the category CoachDropdown (current value label) and pick 跑酷.
		await fireEvent.click(getByText('全部課程類型'));
		// "跑酷" appears both as a dropdown option (a <button>) and a legend chip
		// (a <span>) — click the option button, not the legend.
		const parkour = getAllByText('跑酷').find((el) => el.closest('button'));
		expect(parkour).toBeTruthy();
		await fireEvent.click(parkour!);
		// 跑酷 course stays, 啦啦隊 course is filtered out.
		expect(getByText('跑酷入門')).toBeInTheDocument();
		expect(queryByText('啦啦隊基礎')).toBeNull();
	});
});
