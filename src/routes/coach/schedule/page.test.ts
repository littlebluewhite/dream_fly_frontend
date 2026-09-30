import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SchedulePage from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getSchedule() 走真實 fetch
 * adapter；教練身分(requireCoach)經 loginAs() 驅動，每個測試先登出再登入避免 session
 * 閘門快取跨測試殘留(同 mobile-admin/coach/page.test.ts 慣例)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// Task 1(C2 死種子退役):coach/data.ts 的 SCHED_COURSES(值)已退役——改為檔內
// inline fixture。R16 Task 2a:可授課時段只有 day/start/end。R16 Task 8:改為
// GET /coaches/{id}/schedule 的 wire 形狀(day_of_week 2=Tue、3=Wed)。
const SCHEDULE_PATH = 'GET /coaches/co1/schedule';
const SLOTS = [
	{ id: 'sl1', day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00', is_available: true },
	{ id: 'sl2', day_of_week: 3, start_time: '16:00:00', end_time: '17:00:00', is_available: true }
];

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ [SCHEDULE_PATH]: SLOTS, ...overrides }, COACH_ROUTES));

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

/* 排課管理 page — now interactive: 日/週/月 toggle, prev/next/今日.
 * Anchor defaults to the real current date (Task 1: 1.2); assertions below
 * match courses by weekday key, not by an exact date, so they stay
 * deterministic regardless of which real week the test runs in.
 * Data now arrives through the getSchedule() seam (async, real fetch adapter), so every assertion
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
		route({ [SCHEDULE_PATH]: new Error('network') });
		const { findByText } = render(SchedulePage);
		await findByText('載入失敗');
	});

	it('CoachNotFoundError（查無教練檔案）時，顯示「此帳號未綁定教練檔案」而非泛用載入失敗', async () => {
		route({ 'GET /coaches': [] }); // 查無本人教練檔案 → 真 CoachNotFoundError
		const { findByText, queryByText } = render(SchedulePage);
		await findByText('此帳號未綁定教練檔案');
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('loading:顯示骨架', () => {
		// 只讓排課端點卡住(身分照常回應，理由見 mobile-admin/coach/page.test.ts loading 註解)。
		route({ [SCHEDULE_PATH]: () => new Promise(() => {}) });
		const { getByTestId } = render(SchedulePage);
		expect(getByTestId('schedule-skeleton')).toBeTruthy();
	});
});
