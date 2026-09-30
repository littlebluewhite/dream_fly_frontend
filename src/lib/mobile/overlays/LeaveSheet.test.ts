import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LeaveSheet from './LeaveSheet.svelte';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { toasts } from '$lib/mobile/stores';
import type { EnrolledCourse as MyCourse } from '$lib/domain/member-app';

/* Task 19：LeaveSheet 從「COURSE_SESSIONS mock 查表 + 本地 isDone 假成功」改真
 * 後端 —— 開啟時打 GET /courses/{course_id}/sessions、送出打 POST
 * /leave-requests(復用桌面 Task 11 seam)。之前這個
 * 元件沒有既有測試(純 mock、無網路互動)，這裡是新增覆蓋，非「更新既有測試」。
 * 卡 2:表單機制的單元覆蓋在 $lib/member/leave-form.test.ts;Task 7(架構深化
 * R15·F-4)起工廠與 deps 皆改元件直取 $lib/member/leave-form、$lib/member/leave。
 *
 * Task 1(架構深化 R14·F6):改走 $lib/api/client + fakeRouter(寫法照
 * self-account.test.ts) —— 不 mock deps，斷言改成
 * 「打了哪個端點、帶什麼 body」，同 profile.test.ts 的 fetch-adapter 慣例。成功
 * 送出後 createLeaveRequest 走 gate.mutate:leaveRequests store 進場未水合
 * (wasHydrated=false)，寫回後會尾隨一次和解重抓，故成功案例額外要 route
 * GET /leave-requests/me。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const COURSE: MyCourse = {
	id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', level: '進階', icon: 'sparkles', color: '#0066CC', schedule: '', att: 90, attended: 9, total: 10
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

describe('LeaveSheet — 真後端場次載入', () => {
	it('開啟時打 GET /courses/{course_id}/sessions(復用 course_id，非 course.id)', async () => {
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		await screen.findByText('請假日期', { exact: false }).catch(() => {});
		expect(vi.mocked(api)).toHaveBeenCalledWith('/courses/c1/sessions');
	});

	it('無未來場次時顯示誠實空狀態，不再退回 mock 場次清單', async () => {
		route({ 'GET /courses/c1/sessions': [] });
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		expect(await screen.findByText('沒有可請假的未來場次')).toBeInTheDocument();
	});

	it('場次載入失敗顯示 ErrorState', async () => {
		route({ 'GET /courses/c1/sessions': new Error('boom') });
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});

describe('LeaveSheet — 送出真請假申請(POST /leave-requests)', () => {
	it('成功送出後顯示成功畫面，且打 POST /leave-requests 帶 session_id + reason', async () => {
		route({
			'POST /leave-requests': {
				id: 'lr1', course_id: 'c1', course_name: COURSE.name, session_id: 's1', session_date: '2026-07-10',
				start_time: '19:00:00', reason: '出國', status: 'pending', makeup_session_id: null,
				makeup_session_date: null, makeup_start_time: null, created_at: '2026-07-01T00:00:00Z'
			},
			'GET /leave-requests/me': [] // gate.mutate 進場未水合，寫回後尾隨一次和解重抓
		});
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });
		await screen.findByText('送出申請', { exact: false });

		const select = await screen.findByLabelText('請假場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.input(screen.getByLabelText('補充說明'), { target: { value: '出國' } });
		await fireEvent.click(screen.getByText('送出申請'));

		expect(await screen.findByText('請假申請已送出')).toBeInTheDocument();
		expect(postBodies('/leave-requests')).toEqual([{ session_id: 's1', reason: '出國' }]);
	});

	it('失敗（409）時顯示精確繁中錯誤 toast，不切到成功畫面（ApiError 透傳映射佈線釘）', async () => {
		route({ 'POST /leave-requests': new ApiError(409, '此場次已有請假紀錄') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });

		const select = await screen.findByLabelText('請假場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('送出申請'));

		await vi.waitFor(() => expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', '此場次已有請假紀錄'));
		expect(screen.queryByText('請假申請已送出')).toBeNull();
	});

	// codex R2：ApiError 精確釘之外，泛用 fallback 路徑（非 ApiError 的未知錯誤）也要
	// 保有 render 層演練——兩條輸入域各測各的。Makeup 共用同一 leaveRequestErrorMessage
	// 映射，泛用線由本檔代表覆蓋。
	it('失敗（非 ApiError 的未知錯誤）→ 泛用連線文案 toast', async () => {
		route({ 'POST /leave-requests': new Error('boom') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(LeaveSheet, { props: { onClose: () => {}, course: COURSE } });

		const select = await screen.findByLabelText('請假場次', { exact: false });
		await fireEvent.change(select, { target: { value: 's1' } });
		await fireEvent.click(screen.getByText('送出申請'));

		await vi.waitFor(() => expect(notifySpy).toHaveBeenCalledWith('error', '請假申請失敗', '連線發生問題，請稍後再試。'));
	});
});
