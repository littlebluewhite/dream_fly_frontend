import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SchedulePage from './+page.svelte';
import type { SchedCourse } from '$lib/coach/data';
import { getSchedule } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getSchedule: vi.fn() }));

// Task 1(C2 死種子退役):coach/data.ts 的 SCHED_COURSES(值)已退役——改為檔內
// inline fixture。R16 Task 2a:可授課時段只有 day/start/end。
const SCHED_COURSES: SchedCourse[] = [
	{ day: 'Tue', start: '10:00', end: '11:00' },
	{ day: 'Wed', start: '16:00', end: '17:00' }
];

beforeEach(() => {
	vi.mocked(getSchedule).mockReset();
	vi.mocked(getSchedule).mockResolvedValue({ courses: SCHED_COURSES });
});

/* 排課管理 page — now interactive: 日/週/月 toggle, prev/next/今日.
 * Anchor defaults to the real current date (Task 1: 1.2); assertions below
 * match courses by weekday key, not by an exact date, so they stay
 * deterministic regardless of which real week the test runs in.
 * Data now arrives through the getSchedule() seam (async), so every assertion
 * first awaits the ready phase. */
describe('/coach/schedule (+page) — interactive', () => {
	it('defaults to the 週 view (time grid present) showing all courses', async () => {
		const { container, getByText, findByText } = render(SchedulePage);
		await findByText('08:00');
		const txt = container.textContent ?? '';
		// week grid renders SCHED_HOURS time labels; month view does not.
		expect(txt).toContain('08:00');
		// the Tue and Wed availability slots are both visible.
		expect(getByText('10:00-11:00')).toBeInTheDocument();
		expect(getByText('16:00-17:00')).toBeInTheDocument();
	});

	it('switching to 月 swaps to the month view (time grid gone)', async () => {
		const { container, getByText, findByText } = render(SchedulePage);
		await findByText('08:00');
		await fireEvent.click(getByText('月'));
		const txt = container.textContent ?? '';
		// month view has no SCHED_HOURS time column.
		expect(txt).not.toContain('08:00');
		// weekday header (一…日) still present.
		expect(getByText('一')).toBeInTheDocument();
	});

	it('分類/場館篩選、分類圖例與「點擊空白時段可新增課程」提示已拿掉(R16 Task 2a)', async () => {
		const { container, findByText } = render(SchedulePage);
		await findByText('08:00');
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('全部課程類型');
		expect(txt).not.toContain('所有場館');
		expect(txt).not.toContain('課程類別');
		expect(txt).not.toContain('點擊空白時段');
	});
});

describe('/coach/schedule — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getSchedule).mockReset();
		vi.mocked(getSchedule).mockRejectedValue(new Error('network'));
		const { findByText } = render(SchedulePage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError（查無教練檔案）時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		vi.mocked(getSchedule).mockReset();
		const notFound = new Error('此帳號未綁定教練檔案');
		notFound.name = 'CoachNotFoundError';
		vi.mocked(getSchedule).mockRejectedValue(notFound);
		const { findByText, queryByText } = render(SchedulePage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getSchedule).mockReset();
		vi.mocked(getSchedule).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(SchedulePage);
		expect(getByTestId('schedule-skeleton')).toBeTruthy();
	});
});
