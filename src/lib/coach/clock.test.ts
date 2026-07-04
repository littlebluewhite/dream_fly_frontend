/* Dream Fly — coach/clock.ts 單測(Task 19：打卡動作，本任務唯一的寫入操作)。
 * 只 mock $lib/api/client 的 api()，同 api.test.ts 的作法。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clockIn, clockOut } from './clock';
import { api, ApiError } from '$lib/api/client';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('clockIn — POST /coaches/{id}/clock-in', () => {
	it('成功打卡回傳 ClockRecord；帶 note 時 body 含 note', async () => {
		const record = { id: 'r1', clock_in: '2026-07-04T08:00:00Z', clock_out: null, note: '準時到班', created_at: '2026-07-04T08:00:00Z' };
		vi.mocked(api).mockResolvedValue(record);

		const result = await clockIn('co1', '準時到班');

		expect(api).toHaveBeenCalledWith('/coaches/co1/clock-in', {
			method: 'POST',
			body: JSON.stringify({ note: '準時到班' })
		});
		expect(result).toEqual(record);
	});

	it('未帶 note 時 body 為空物件', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'r1', clock_in: '', clock_out: null, note: null, created_at: '' });

		await clockIn('co1');

		expect(api).toHaveBeenCalledWith('/coaches/co1/clock-in', {
			method: 'POST',
			body: JSON.stringify({})
		});
	});

	it('後端 409(已在上班中)時，錯誤原樣拋出供呼叫端顯示「已在上班中」', async () => {
		vi.mocked(api).mockRejectedValue(new ApiError(409, 'already clocked in'));

		await expect(clockIn('co1')).rejects.toMatchObject({ status: 409 });
	});
});

describe('clockOut — POST /coaches/{id}/clock-out', () => {
	it('成功下班打卡回傳 ClockRecord，不帶 body', async () => {
		const record = { id: 'r1', clock_in: '2026-07-04T08:00:00Z', clock_out: '2026-07-04T17:00:00Z', note: null, created_at: '2026-07-04T08:00:00Z' };
		vi.mocked(api).mockResolvedValue(record);

		const result = await clockOut('co1');

		expect(api).toHaveBeenCalledWith('/coaches/co1/clock-out', { method: 'POST' });
		expect(result).toEqual(record);
	});

	it('後端 404(尚未上班/沒有進行中的打卡)時，錯誤原樣拋出', async () => {
		vi.mocked(api).mockRejectedValue(new ApiError(404, 'no active clock-in record found'));

		await expect(clockOut('co1')).rejects.toMatchObject({ status: 404 });
	});
});
