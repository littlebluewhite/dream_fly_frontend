import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LeaveSheet from './LeaveSheet.svelte';
import { getCourseSessions, createLeaveRequest } from '$lib/member/stores';
import { toasts } from '$lib/mobile/stores';
import type { MyCourse } from '$lib/mobile/data';

/* Task 19：LeaveSheet 從「COURSE_SESSIONS mock 查表 + 本地 isDone 假成功」改真
 * 後端 —— 開啟時打 GET /courses/{course_id}/sessions、送出打 POST
 * /leave-requests(復用桌面 Task 11 seam，見 $lib/member/stores.ts)。之前這個
 * 元件沒有既有測試(純 mock、無網路互動)，這裡是新增覆蓋，非「更新既有測試」。 */
vi.mock('$lib/member/stores', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/stores')>();
	return { ...actual, getCourseSessions: vi.fn(), createLeaveRequest: vi.fn() };
});

const COURSE: MyCourse = {
	id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '林雅婷',
	icon: 'sparkles', color: '#0066CC', schedule: '', room: '', att: 90, attended: 9, total: 10,
	next: '', term: '', remain: 0
};

const SESSIONS = [{ id: 's1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' }];

beforeEach(() => {
	vi.mocked(getCourseSessions).mockReset().mockResolvedValue(SESSIONS);
	vi.mocked(createLeaveRequest).mockReset();
});

describe('LeaveSheet — 真後端場次載入', () => {
	it('開啟時打 GET /courses/{course_id}/sessions(復用 course_id，非 course.id)', async () => {
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		await screen.findByText('請假日期', { exact: false }).catch(() => {});
		expect(getCourseSessions).toHaveBeenCalledWith('c1');
	});

	it('無未來場次時顯示誠實空狀態，不再退回 mock 場次清單', async () => {
		vi.mocked(getCourseSessions).mockResolvedValue([]);
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		expect(await screen.findByText('沒有可請假的未來場次')).toBeInTheDocument();
	});

	it('場次載入失敗顯示 ErrorState', async () => {
		vi.mocked(getCourseSessions).mockRejectedValue(new Error('boom'));
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});

describe('LeaveSheet — 送出真請假申請(POST /leave-requests)', () => {
	it('成功送出後顯示成功畫面，且真的呼叫 createLeaveRequest(sessionId, reason)', async () => {
		vi.mocked(createLeaveRequest).mockResolvedValue({
			id: 'lr1', course_id: 'c1', course_name: COURSE.name, session_id: 's1', session_date: '2026-07-10',
			start_time: '19:00:00', reason: '出國', status: 'pending', makeup_session_id: null,
			makeup_session_date: null, makeup_start_time: null, created_at: '2026-07-01T00:00:00Z'
		});
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		await screen.findByText('送出申請', { exact: false });

		const select = await screen.findByLabelText('請假場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.input(screen.getByLabelText('補充說明'), { target: { value: '出國' } });
		await fireEvent.click(screen.getByText('送出申請'));

		await vi.waitFor(() => expect(createLeaveRequest).toHaveBeenCalledWith('s1', '出國'));
		expect(await screen.findByText('請假申請已送出')).toBeInTheDocument();
	});

	it('失敗時顯示錯誤 toast，不切到成功畫面', async () => {
		vi.mocked(createLeaveRequest).mockRejectedValue(new Error('此場次已有請假紀錄'));
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });

		const select = await screen.findByLabelText('請假場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('送出申請'));

		await vi.waitFor(() => expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', expect.any(String)));
		expect(screen.queryByText('請假申請已送出')).toBeNull();
	});
});
