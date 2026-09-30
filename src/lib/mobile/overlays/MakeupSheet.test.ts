import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MakeupSheet from './MakeupSheet.svelte';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { toasts } from '$lib/mobile/stores';
import type { LeaveRequest } from '$lib/member/leave';

/* Task 19：MakeupSheet 從「MAKEUP_SLOTS 課程層級 mock + 本地 isDone 假成功」改真
 * 後端，且改吃 leaveRequest prop(不是 course)——同桌面 Task 11 的既有裁決：
 * 補課預約是針對一張已核准請假申請的動作,見 $lib/member/components/
 * MakeupDialog.svelte。之前這個元件沒有既有測試，這裡是新增覆蓋。
 * 卡 2:表單機制的單元覆蓋在 $lib/member/leave-form.test.ts;Task 7(架構深化
 * R15·F-4)起工廠與 deps 皆改元件直取 $lib/member/leave-form、$lib/member/leave。這裡
 * 保留元件端佈線,並釘住 mobile 版成功 toast body 字面(與桌面 MakeupDialog 分歧)。
 *
 * Task 1(架構深化 R14·F6):改走 $lib/api/client + fakeRouter(寫法照
 * self-account.test.ts) —— 不 mock deps，斷言改成
 * 「打了哪個端點、帶什麼 body」。leaveRequests store 在本檔進場未水合，bookMakeup
 * 走 gate.mutate 寫回後會尾隨一次和解重抓，成功案例額外要 route
 * GET /leave-requests/me。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const LEAVE_REQUEST: LeaveRequest = {
	id: 'lr1', course_id: 'c1', course_name: '競技啦啦隊 進階班', session_id: 's0',
	session_date: '2026-06-20', start_time: '19:00:00', reason: null, status: 'approved',
	makeup_session_id: null, makeup_session_date: null, makeup_start_time: null, created_at: '2026-06-01T00:00:00Z'
};

const SESSIONS = [{ id: 's1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' }];

type Routes = Record<string, unknown>;
let routes: Routes;
function route(extra: Routes) {
	routes = { ...routes, ...extra };
}
function postBodies(path: string): Record<string, unknown>[] {
	return vi.mocked(api).mock.calls
		.filter(([p, init]) => p === path && init?.method === 'POST')
		.map(([, init]) => JSON.parse(String(init!.body)));
}

beforeEach(() => {
	routes = { 'GET /courses/c1/sessions': SESSIONS };
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
});

describe('MakeupSheet — 真後端場次載入(依 leaveRequest.course_id，非課程層級)', () => {
	it('開啟時打 GET /courses/{course_id}/sessions', async () => {
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });
		await screen.findByLabelText('補課場次', { exact: false });
		expect(vi.mocked(api)).toHaveBeenCalledWith('/courses/c1/sessions');
	});

	it('無可預約場次時顯示誠實空狀態，不再退回 mock MAKEUP_SLOTS', async () => {
		route({ 'GET /courses/c1/sessions': [] });
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });
		expect(await screen.findByText('目前沒有可預約的補課場次')).toBeInTheDocument();
	});

	it('場次載入失敗顯示 ErrorState', async () => {
		route({ 'GET /courses/c1/sessions': new Error('boom') });
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});

describe('MakeupSheet — 確認預約(POST /leave-requests/{id}/makeup)', () => {
	it('成功後顯示成功畫面，且打 POST /leave-requests/lr1/makeup 帶 session_id', async () => {
		route({
			'POST /leave-requests/lr1/makeup': {
				...LEAVE_REQUEST, makeup_session_id: 's1', makeup_session_date: '2026-07-10', makeup_start_time: '19:00:00'
			},
			'GET /leave-requests/me': [] // gate.mutate 進場未水合，寫回後尾隨一次和解重抓
		});
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });

		const select = await screen.findByLabelText('補課場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('確認預約'));

		expect(await screen.findByText('補課預約成功')).toBeInTheDocument();
		expect(postBodies('/leave-requests/lr1/makeup')).toEqual([{ session_id: 's1' }]);
	});

	it('成功 toast body 的 mobile 字面釘:只有補課時間、無 course_name 前綴(與桌面 MakeupDialog 的 body 分歧,兩面各釘各的)', async () => {
		route({
			'POST /leave-requests/lr1/makeup': {
				...LEAVE_REQUEST, makeup_session_id: 's1', makeup_session_date: '2026-07-10', makeup_start_time: '19:00:00'
			},
			'GET /leave-requests/me': []
		});
		// mockClear:toasts.notify 的 spy 跨 it 不重置,先清空,這條釘才只驗本 it 的呼叫。
		const notifySpy = vi.spyOn(toasts, 'notify').mockClear();
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });

		const select = await screen.findByLabelText('補課場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('確認預約'));

		await vi.waitFor(() => expect(notifySpy).toHaveBeenCalledWith('success', '補課已預約', '2026-07-10 (五) 19:00'));
	});

	it('失敗（409）時顯示精確繁中錯誤 toast，不切到成功畫面（ApiError 透傳映射佈線釘）', async () => {
		route({ 'POST /leave-requests/lr1/makeup': new ApiError(409, '該場次名額已滿') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(MakeupSheet, { props: { onClose: () => {}, leaveRequest: LEAVE_REQUEST } });

		const select = await screen.findByLabelText('補課場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('確認預約'));

		await vi.waitFor(() => expect(notifySpy).toHaveBeenCalledWith('error', '預約補課失敗', '該場次名額已滿'));
		expect(screen.queryByText('補課預約成功')).toBeNull();
	});
});
