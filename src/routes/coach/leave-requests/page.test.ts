import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LeaveRequestsPage from './+page.svelte';
import { toasts } from '$lib/coach/stores';
import { api, ApiError } from '$lib/api/client';
import type { ApiLeaveRequest } from '$lib/api/wire';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs } from '$lib/testing/coach-session';
import { COACH_ROUTES, COACH_USER } from '$lib/testing/coach-routes';
import { authStore } from '$lib/stores/authStore';

/* 請假審核 — 教練待審清單（Task 11；GET /leave-requests?status=pending +
 * PATCH /leave-requests/{id}，見 integration-contract.md §3.20）。三態閘門
 * （loading/error/ready），核准/婉拒後從清單移除（同 coach/students 頁的
 * getStudents() 接縫慣例，錯誤分支直接顯示 ApiError.message——見 coach/api.ts
 * 對 decideLeaveRequest 的註解，這個後端模組的錯誤字串本身就是繁中）。
 * R16 Task 8(候選 10):改 mock $lib/api/client 的 api()，getPendingLeaveRequests/
 * decideLeaveRequest 走真實 fetch adapter；原本斷言 decideLeaveRequest(id, status)
 * 的呼叫參數，改斷言送出的 PATCH /leave-requests/{id} body。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

type WireLeaveRequest = ApiLeaveRequest & { user_id: string; user_name: string };
const wire = (r: Pick<WireLeaveRequest, 'id' | 'course_name' | 'user_name' | 'session_date' | 'start_time' | 'reason' | 'created_at'>): WireLeaveRequest => ({
	course_id: 'c-x', session_id: `s-${r.id}`, user_id: `u-${r.id}`, status: 'pending',
	makeup_session_id: null, makeup_session_date: null, makeup_start_time: null, decided_at: null, ...r
});
const REQUESTS: WireLeaveRequest[] = [
	wire({ id: 'lr-1', course_name: '兒童體操初階班', user_name: '王小明', session_date: '2026-07-10', start_time: '19:00:00', reason: '生病', created_at: '2026-07-01T00:00:00Z' }),
	wire({ id: 'lr-2', course_name: '競技選手班', user_name: '陳小華', session_date: '2026-07-12', start_time: '10:00:00', reason: null, created_at: '2026-07-02T00:00:00Z' })
];

const LIST_PATH = 'GET /leave-requests?status=pending&per_page=100';
const page = (leave_requests: WireLeaveRequest[], total = leave_requests.length) => ({ leave_requests, total, page: 1, per_page: 100 });

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(
			{ [LIST_PATH]: page(REQUESTS), 'PATCH /leave-requests/lr-1': REQUESTS[0], 'PATCH /leave-requests/lr-2': REQUESTS[1], ...overrides },
			COACH_ROUTES
		)
	);

/** PATCH /leave-requests/{id} 送出的 body——取代原本斷言 decideLeaveRequest 呼叫參數。 */
const patchBody = (id: string) => {
	const call = vi.mocked(api).mock.calls.find(([p, init]) => p === `/leave-requests/${id}` && init?.method === 'PATCH');
	return call ? JSON.parse(call[1]!.body as string) : undefined;
};

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(COACH_USER);
	route();
});

describe('/coach/leave-requests (+page) — 渲染', () => {
	it('renders the heading count and every pending request (user_name/course_name/session/reason)', async () => {
		const { findByText, container } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');
		const txt = container.textContent ?? '';
		expect(txt).toContain('共 2 筆待審核');
		expect(txt).toContain('陳小華 · 競技選手班');
		expect(txt).toContain('2026-07-10 (五) 19:00');
		expect(txt).toContain('生病');
	});

	it('shows an empty state when there are no pending requests', async () => {
		route({ [LIST_PATH]: page([]) });
		const { findByText } = render(LeaveRequestsPage);
		await findByText('目前沒有待審核的請假申請');
	});
});

describe('/coach/leave-requests — 分頁截斷（total 穿透，防計數/空狀態說謊）', () => {
	it('total 大於載入筆數：計數顯示 total、清單底部出現截斷提示', async () => {
		route({ [LIST_PATH]: page(REQUESTS, 150) });
		const { findByText, container } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');
		const txt = container.textContent ?? '';
		expect(txt).toContain('共 150 筆待審核');
		expect(txt).toContain('僅顯示前 2 筆');
	});

	it('total 等於載入筆數：計數一致且無截斷提示', async () => {
		// beforeEach 預設 total = REQUESTS.length = 2
		const { findByText, container } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');
		const txt = container.textContent ?? '';
		expect(txt).toContain('共 2 筆待審核');
		expect(txt).not.toContain('僅顯示前');
	});

	it('審核成功後計數以 total 遞減（非以截斷後陣列長度重算）', async () => {
		route({ [LIST_PATH]: page(REQUESTS, 150) });
		const { findByText, getAllByText, container } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => expect(container.textContent).toContain('共 149 筆待審核'));
	});

	it('本頁全部審完但 total 仍有剩：不顯示「目前沒有待審核」空狀態，改示未載入提示', async () => {
		route({ [LIST_PATH]: page([REQUESTS[0]], 21) });
		const { findByText, getAllByText, queryByText, container } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => expect(queryByText('王小明 · 兒童體操初階班')).toBeNull());
		expect(queryByText('目前沒有待審核的請假申請')).toBeNull(); // 空狀態不得說謊
		expect(container.textContent).toContain('尚有 20 筆待審核尚未載入');
	});
});

describe('/coach/leave-requests — 三態', () => {
	it('error：顯示「載入失敗」', async () => {
		route({ [LIST_PATH]: new Error('network') });
		const { findByText } = render(LeaveRequestsPage);
		await findByText('載入失敗');
	});

	it('loading：顯示骨架', () => {
		route({ [LIST_PATH]: () => new Promise(() => {}) });
		const { getByTestId } = render(LeaveRequestsPage);
		expect(getByTestId('leave-requests-skeleton')).toBeTruthy();
	});
});

describe('/coach/leave-requests — 核准/婉拒（PATCH /leave-requests/{id}）', () => {
	it('點擊「核准」→ PATCH { status: "approved" }，成功後從清單移除並顯示成功 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		const { findByText, getAllByText, queryByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		expect(patchBody('lr-1')).toEqual({ status: 'approved' });
		await vi.waitFor(() => expect(queryByText('王小明 · 兒童體操初階班')).toBeNull());
		expect(notifySpy).toHaveBeenCalledWith('success', '已核准請假申請', expect.stringContaining('王小明'));
	});

	it('點擊「婉拒」→ PATCH { status: "rejected" }，成功後從清單移除', async () => {
		const { findByText, getAllByText, queryByText } = render(LeaveRequestsPage);
		await findByText('陳小華 · 競技選手班');

		await fireEvent.click(getAllByText('婉拒')[1]);

		expect(patchBody('lr-2')).toEqual({ status: 'rejected' });
		await vi.waitFor(() => expect(queryByText('陳小華 · 競技選手班')).toBeNull());
		// 另一筆(lr-1)仍在清單中，未被誤刪。
		expect(screen.getByText('王小明 · 兒童體操初階班')).toBeInTheDocument();
	});

	it('403（非本課教練）→ 顯示對應繁中錯誤 toast，清單不變（後端訊息直接透傳）', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'PATCH /leave-requests/lr-1': new ApiError(403, '非本課教練') });
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '審核失敗', '非本課教練');
		});
		expect(screen.getByText('王小明 · 兒童體操初階班')).toBeInTheDocument(); // 未移除
	});

	it('404（請假申請不存在）→ 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'PATCH /leave-requests/lr-1': new ApiError(404, '請假申請不存在') });
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '審核失敗', '請假申請不存在');
		});
	});

	it('409（僅待審核假單可審核）→ 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'PATCH /leave-requests/lr-1': new ApiError(409, '僅待審核假單可審核') });
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '審核失敗', '僅待審核假單可審核');
		});
	});

	it('422（status 非 approved/rejected）→ 顯示對應繁中錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'PATCH /leave-requests/lr-1': new ApiError(422, 'status 僅接受 approved 或 rejected') });
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '審核失敗', 'status 僅接受 approved 或 rejected');
		});
	});

	it('非 ApiError（如網路失敗）→ 顯示通用錯誤 toast', async () => {
		const notifySpy = vi.spyOn(toasts, 'notify');
		route({ 'PATCH /leave-requests/lr-1': new Error('network down') });
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '審核失敗', '連線發生問題，請稍後再試。');
		});
	});

	it('決定進行中該筆的核准/婉拒按鈕停用，避免重複送出', async () => {
		route({ 'PATCH /leave-requests/lr-1': () => new Promise(() => {}) }); // never resolves
		const { findByText, getAllByText } = render(LeaveRequestsPage);
		await findByText('王小明 · 兒童體操初階班');

		await fireEvent.click(getAllByText('核准')[0]);

		expect(getAllByText('核准')[0].closest('button')).toBeDisabled();
		expect(getAllByText('婉拒')[0].closest('button')).toBeDisabled();
	});
});
