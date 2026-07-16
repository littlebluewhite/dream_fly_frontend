import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCancelLeave } from './cancel-leave';
import type { LeaveRequest } from './leave';

/* cancel-leave.ts — member 取消請假動作的單元測試（卡 6）。只測機制（busy 守衛/
 * 旗標生命週期/outcome 攜帶原始拋出物），deps 注入 mock、無渲染；元件端的
 * leaveRequestErrorMessage 映射 + toast 佈線仍由兩個 render 套件把關
 * （member/mine page.test.ts、MyCourseDetail.test.ts）。 */

const LR: LeaveRequest = {
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

/** 手動控制 resolve/reject 時序的 promise，用於驗 in-flight 期間的守衛語意
 *  （同 leave-form.test.ts 範本）。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDeps() {
	return { cancelLeaveRequest: vi.fn<(id: string) => Promise<void>>() };
}

let deps: ReturnType<typeof makeDeps>;
let ctl: ReturnType<typeof createCancelLeave>;

beforeEach(() => {
	deps = makeDeps();
	ctl = createCancelLeave(deps);
});

describe('createCancelLeave', () => {
	it('成功：outcome 攜帶 course_name；busy 旗標生命週期（起飛同步設 id、resolve 後復位）', async () => {
		const d = deferred<void>();
		deps.cancelLeaveRequest.mockReturnValue(d.promise);
		expect(get(ctl).cancellingLeaveId).toBeNull(); // 建構零副作用

		const p = ctl.cancelLeave(LR); // 起飛，旗標同步翻上（不等 resolve）
		expect(deps.cancelLeaveRequest).toHaveBeenCalledWith('lr-1');
		expect(get(ctl).cancellingLeaveId).toBe('lr-1');

		d.resolve();
		expect(await p).toEqual({ kind: 'leaveCancelled', courseName: '競技啦啦隊 進階班' });
		expect(get(ctl).cancellingLeaveId).toBeNull();
	});

	it('busy 守衛：in-flight 期間再呼叫回 null，deps 不被重複呼叫', async () => {
		const d = deferred<void>();
		deps.cancelLeaveRequest.mockReturnValue(d.promise);

		const first = ctl.cancelLeave(LR);
		expect(await ctl.cancelLeave({ ...LR, id: 'lr-2' })).toBeNull(); // 第二發被守衛擋下
		expect(deps.cancelLeaveRequest).toHaveBeenCalledTimes(1);

		d.resolve();
		expect(await first).toEqual({ kind: 'leaveCancelled', courseName: LR.course_name });
	});

	it('失敗：outcome 透傳原始拋出物（非包裝/翻譯），旗標復位', async () => {
		const err = new Error('僅待審核假單可取消');
		deps.cancelLeaveRequest.mockRejectedValue(err);

		const outcome = await ctl.cancelLeave(LR);
		expect(outcome?.kind).toBe('failed');
		if (outcome?.kind === 'failed') expect(outcome.error).toBe(err);
		expect(get(ctl).cancellingLeaveId).toBeNull();
	});

	it('連續兩次序列：第一次完成後可再取消（守衛只擋 in-flight，不是一次性）', async () => {
		deps.cancelLeaveRequest.mockResolvedValue(undefined);

		expect(await ctl.cancelLeave(LR)).toEqual({ kind: 'leaveCancelled', courseName: LR.course_name });

		const second: LeaveRequest = { ...LR, id: 'lr-2', course_name: '幼兒體操 啟蒙班' };
		expect(await ctl.cancelLeave(second)).toEqual({ kind: 'leaveCancelled', courseName: '幼兒體操 啟蒙班' });
		expect(deps.cancelLeaveRequest).toHaveBeenCalledTimes(2);
		expect(deps.cancelLeaveRequest).toHaveBeenLastCalledWith('lr-2');
	});
});
