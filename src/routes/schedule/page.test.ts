import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole } from '@testing-library/svelte';
import Page from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { apiCalls } from '$lib/testing/admin-routes';
import type { DaySchedule } from '$lib/api/generated';

// 只假造 HTTP 層：真的 getSchedule + mapper 會跑
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// 每個測試自己依 year/month 算出路由 key
const scheduleKey = (year: number, month: number) => `GET /schedule?year=${year}&month=${month}`;
const thisMonthKey = () => {
	const d = new Date();
	return scheduleKey(d.getFullYear(), d.getMonth() + 1);
};
const route = (overrides: Record<string, unknown>) => vi.mocked(api).mockImplementation(fakeRouter(overrides));

function todayISO(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
}

function daySchedule(): DaySchedule[] {
	const date = todayISO();
	return [
		{
			date,
			slots: [
				{
					id: 'slot-1',
					date,
					start_time: '06:00:00',
					end_time: '08:00:00',
					venue_id: null,
					course_id: null,
					capacity: 10,
					booked: 2,
					status: 'available',
					price_cents: 0
				},
				{
					id: 'slot-2',
					date,
					start_time: '08:00:00',
					end_time: '10:00:00',
					venue_id: null,
					course_id: null,
					capacity: 10,
					booked: 10,
					status: 'full',
					price_cents: 0
				}
			]
		}
	];
}

beforeEach(() => {
	vi.mocked(api).mockReset();
	route({ [thisMonthKey()]: daySchedule() });
});

describe('課程日程表 (marketing) — 接真 API（取代先前 Math.random() 假資料）', () => {
	it('fetches the current year/month on mount', async () => {
		const { container } = render(Page);
		const today = new Date();
		await findByRole(container, 'button', { name: String(today.getDate()) });

		expect(apiCalls(scheduleKey(today.getFullYear(), today.getMonth() + 1))).toHaveLength(1);
	});

	it('renders real per-slot availability for the selected day, disabling a full slot', async () => {
		const { container, findByText } = render(Page);
		const today = new Date();
		const dayBtn = await findByRole(container, 'button', { name: String(today.getDate()) });
		await fireEvent.click(dayBtn);

		await findByText('06:00-08:00');

		// "額滿" also appears in the always-on legend, so scope the status-label
		// check to the slot button's own text rather than a page-wide findByText.
		const fullSlotBtn = await findByRole(container, 'button', { name: /08:00-10:00/ });
		expect(fullSlotBtn).toBeDisabled();
		expect(fullSlotBtn.textContent).toContain('額滿'); // slot-2's mapped status label

		const openSlotBtn = await findByRole(container, 'button', { name: /06:00-08:00/ });
		expect(openSlotBtn).not.toBeDisabled();
	});

	it('shows an empty-slots message for a day with no schedule entry', async () => {
		route({ [thisMonthKey()]: [] }); // no entry for any date this month

		const { container, findByText } = render(Page);
		const today = new Date();
		const dayBtn = await findByRole(container, 'button', { name: String(today.getDate()) });
		await fireEvent.click(dayBtn);

		await findByText('當日尚無開放時段');
	});

	it('error 態:顯示「載入失敗」', async () => {
		route({ [thisMonthKey()]: new Error('network') });

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示日曆骨架', async () => {
		route({ [thisMonthKey()]: new Promise(() => {}) }); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('schedule-skeleton')).toBeTruthy();
	});

	it('換月清空已選日期與時段,並以新月份 refetch', async () => {
		const today = new Date();
		const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
		const nextKey = scheduleKey(next.getFullYear(), next.getMonth() + 1);
		route({ [thisMonthKey()]: daySchedule(), [nextKey]: [] });

		const { container, queryByText } = render(Page);
		const dayBtn = await findByRole(container, 'button', { name: String(today.getDate()) });
		await fireEvent.click(dayBtn);

		const openSlotBtn = await findByRole(container, 'button', { name: /06:00-08:00/ });
		await fireEvent.click(openSlotBtn);
		await findByRole(container, 'button', { name: /確認預約 06:00-08:00/ });

		const nextBtn = await findByRole(container, 'button', { name: '>' });
		await fireEvent.click(nextBtn);

		// 等下月格線渲染完(1 日必存在)再斷言,避免撞上骨架態。
		await findByRole(container, 'button', { name: '1' });
		expect(apiCalls(nextKey)).toHaveLength(1); // 以新月份 refetch
		expect(queryByText(/可預約時段/)).toBeNull(); // selectedDate 已清 → 時段區塊消失
		expect(queryByText(/確認預約/)).toBeNull(); // selectedTimeSlot 已清 → 確認鈕消失
	});
});
