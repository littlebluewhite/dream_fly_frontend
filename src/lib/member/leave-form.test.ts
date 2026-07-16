import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createLeaveRequestForm, createMakeupBookingForm } from './leave-form';
import type { CourseSession, LeaveRequest } from './leave';

/* leave-form.ts — member 請假/補課表單機的單元測試（卡 2）。只測 machine 機制
 * （三態/守衛/trim/防雙送/錯誤透傳），deps 全注入 mock、無渲染；元件端的
 * leaveRequestErrorMessage 映射 + toast 佈線 + 409/404/422 錯誤路徑仍由四個
 * render 套件各自把關（LeaveDialog/MakeupDialog/LeaveSheet/MakeupSheet.test.ts），
 * 兩層各測各的：這裡只斷言 failed outcome 攜帶「原始拋出物」。 */

const SESSIONS: CourseSession[] = [
	{ id: 'sess-1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' },
	{ id: 'sess-2', session_date: '2026-07-12', start_time: '19:00:00', end_time: '20:30:00' }
];

const REQUEST: LeaveRequest = {
	id: 'lr-1',
	course_id: 'course-1',
	course_name: '競技啦啦隊 進階班',
	session_id: 'sess-1',
	session_date: '2026-07-10',
	start_time: '19:00:00',
	reason: null,
	status: 'pending',
	makeup_session_id: null,
	makeup_session_date: null,
	makeup_start_time: null,
	created_at: '2026-07-01T00:00:00Z'
};

const UPDATED: LeaveRequest = {
	...REQUEST,
	status: 'approved',
	makeup_session_id: 'sess-2',
	makeup_session_date: '2026-07-12',
	makeup_start_time: '19:00:00'
};

const INITIAL_VIEW = { sessionsPhase: 'loading', sessions: [], submitting: false, valid: false };

/** 手動控制 resolve/reject 時序的 promise，用於驗 in-flight 期間的守衛語意。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeLeaveDeps() {
	return {
		getCourseSessions: vi.fn<(courseId: string) => Promise<CourseSession[]>>(),
		createLeaveRequest: vi.fn<(sessionId: string, reason?: string) => Promise<LeaveRequest>>()
	};
}

function makeMakeupDeps() {
	return {
		getCourseSessions: vi.fn<(courseId: string) => Promise<CourseSession[]>>(),
		bookMakeup: vi.fn<(leaveRequestId: string, sessionId: string) => Promise<LeaveRequest>>()
	};
}

let deps: ReturnType<typeof makeLeaveDeps>;
let form: ReturnType<typeof createLeaveRequestForm>;

beforeEach(() => {
	deps = makeLeaveDeps();
	form = createLeaveRequestForm(deps);
});

describe('createLeaveRequestForm — 場次三態機（load / reset）', () => {
	it('建構零副作用（不觸發 deps）；load 以 courseId 打 deps 後 loading→ready，sessions 鏡射回應', async () => {
		expect(get(form)).toEqual(INITIAL_VIEW);
		expect(deps.getCourseSessions).not.toHaveBeenCalled();

		const d = deferred<CourseSession[]>();
		deps.getCourseSessions.mockReturnValue(d.promise);
		form.load('course-1');
		expect(deps.getCourseSessions).toHaveBeenCalledWith('course-1');
		expect(get(form).sessionsPhase).toBe('loading');

		d.resolve(SESSIONS);
		await d.promise;
		expect(get(form).sessionsPhase).toBe('ready');
		expect(get(form).sessions).toEqual(SESSIONS);
	});

	it('load 失敗 → error；retry（再呼叫 load）回 loading 後恢復 ready', async () => {
		deps.getCourseSessions.mockRejectedValueOnce(new Error('network'));
		form.load('course-1');
		await vi.waitFor(() => {
			expect(get(form).sessionsPhase).toBe('error');
		});

		deps.getCourseSessions.mockResolvedValueOnce(SESSIONS);
		form.load('course-1');
		expect(get(form).sessionsPhase).toBe('loading');
		await vi.waitFor(() => {
			expect(get(form).sessionsPhase).toBe('ready');
		});
		expect(get(form).sessions).toEqual(SESSIONS);
		expect(deps.getCourseSessions).toHaveBeenCalledTimes(2);
	});

	it('reset 清空 sessionId/reason/sessions 並回初始 loading 態', async () => {
		deps.getCourseSessions.mockResolvedValue(SESSIONS);
		form.load('course-1');
		await vi.waitFor(() => {
			expect(get(form).sessionsPhase).toBe('ready');
		});
		form.sessionId.set('sess-1');
		form.reason.set('身體不適');
		expect(get(form).valid).toBe(true);

		form.reset();
		expect(get(form)).toEqual(INITIAL_VIEW);
		expect(get(form.sessionId)).toBe('');
		expect(get(form.reason)).toBe('');
	});
});

describe('createLeaveRequestForm — submit 守衛與 outcome', () => {
	it('valid 守衛：未選場次 submit 回 null，且不打 deps', async () => {
		expect(await form.submit()).toBeNull();
		expect(deps.createLeaveRequest).not.toHaveBeenCalled();
	});

	it('防雙送：in-flight 期間再 submit 回 null、deps 只被呼叫一次；resolve 後旗標復位', async () => {
		const d = deferred<LeaveRequest>();
		deps.createLeaveRequest.mockReturnValue(d.promise);
		form.sessionId.set('sess-1');

		const first = form.submit(); // 起飛，submitting 同步翻 true（不等 resolve）
		expect(get(form).submitting).toBe(true);
		expect(await form.submit()).toBeNull(); // 第二發被 in-flight 守衛擋下
		expect(deps.createLeaveRequest).toHaveBeenCalledTimes(1);

		d.resolve(REQUEST);
		expect(await first).toEqual({ kind: 'leaveRequested', request: REQUEST });
		expect(get(form).submitting).toBe(false);
	});

	it('reason trim→undefined：全空白事由省略參數，實質文字 trim 後傳遞', async () => {
		deps.createLeaveRequest.mockResolvedValue(REQUEST);
		form.sessionId.set('sess-1');

		form.reason.set('   ');
		await form.submit();
		expect(deps.createLeaveRequest).toHaveBeenCalledWith('sess-1', undefined);

		form.reason.set('  身體不適  ');
		await form.submit();
		expect(deps.createLeaveRequest).toHaveBeenLastCalledWith('sess-1', '身體不適');
	});

	it('錯誤透傳：deps reject → { kind: failed, error } 攜帶原始拋出物，submitting 復位', async () => {
		const err = new Error('此場次已有請假紀錄');
		deps.createLeaveRequest.mockRejectedValue(err);
		form.sessionId.set('sess-1');

		const outcome = await form.submit();
		expect(outcome?.kind).toBe('failed');
		if (outcome?.kind === 'failed') expect(outcome.error).toBe(err); // 原始拋出物，非包裝/翻譯
		expect(get(form).submitting).toBe(false);
	});
});

describe('createMakeupBookingForm — 鏡像', () => {
	it('makeup 鏡像：初始態/valid 守衛/三態同型，submit(leaveRequestId) 以 (id, sessionId) 呼叫 bookMakeup', async () => {
		const mdeps = makeMakeupDeps();
		const mform = createMakeupBookingForm(mdeps);

		// 初始態與 valid 守衛鏡像 leave 版
		expect(get(mform)).toEqual(INITIAL_VIEW);
		expect(await mform.submit('lr-1')).toBeNull();
		expect(mdeps.bookMakeup).not.toHaveBeenCalled();

		// 三態載入同型
		mdeps.getCourseSessions.mockResolvedValue(SESSIONS);
		mform.load('course-1');
		expect(mdeps.getCourseSessions).toHaveBeenCalledWith('course-1');
		await vi.waitFor(() => {
			expect(get(mform).sessionsPhase).toBe('ready');
		});

		// 參數斷言 + 領域 outcome
		mdeps.bookMakeup.mockResolvedValue(UPDATED);
		mform.sessionId.set('sess-2');
		const outcome = await mform.submit('lr-1');
		expect(mdeps.bookMakeup).toHaveBeenCalledWith('lr-1', 'sess-2');
		expect(outcome).toEqual({ kind: 'makeupBooked', updated: UPDATED });
		expect(get(mform).submitting).toBe(false);
	});
});
