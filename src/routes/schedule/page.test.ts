import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, findByRole } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getSchedule } from '$lib/public/api';
import type { ApiDaySchedule } from '$lib/public/api';

vi.mock('$lib/public/api', () => ({ getSchedule: vi.fn() }));

function todayISO(): string {
	const d = new Date();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
}

function daySchedule(): ApiDaySchedule[] {
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
					status: 'available'
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
					status: 'full'
				}
			]
		}
	];
}

beforeEach(() => {
	vi.mocked(getSchedule).mockReset();
	vi.mocked(getSchedule).mockResolvedValue(daySchedule());
});

describe('課程日程表 (marketing) — 接真 API（取代先前 Math.random() 假資料）', () => {
	it('fetches the current year/month on mount', async () => {
		const { container } = render(Page);
		const today = new Date();
		await findByRole(container, 'button', { name: String(today.getDate()) });

		expect(getSchedule).toHaveBeenCalledWith(today.getFullYear(), today.getMonth() + 1);
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
		vi.mocked(getSchedule).mockResolvedValue([]); // no entry for any date this month

		const { container, findByText } = render(Page);
		const today = new Date();
		const dayBtn = await findByRole(container, 'button', { name: String(today.getDate()) });
		await fireEvent.click(dayBtn);

		await findByText('當日尚無開放時段');
	});

	it('error 態:顯示「載入失敗」', async () => {
		vi.mocked(getSchedule).mockReset();
		vi.mocked(getSchedule).mockRejectedValue(new Error('network'));

		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading 態:顯示日曆骨架', async () => {
		vi.mocked(getSchedule).mockReset();
		vi.mocked(getSchedule).mockReturnValue(new Promise(() => {})); // never resolves

		const { getByTestId } = render(Page);
		expect(getByTestId('schedule-skeleton')).toBeTruthy();
	});
});
