/* Dream Fly — member 取消請假動作（卡 6，自 member/mine/+page.svelte 與 mobile 的
 * MyCourseDetail 兩處逐字雙生的 doCancelLeave 抽出）。attendance-controller 形（deps
 * 注入、Readable 快照、outcome 用領域 kind）：進模組的是機制——busy 守衛（in-flight
 * 期間再呼叫回 null、不重複打 deps）、cancellingLeaveId 旗標生命週期、失敗 outcome
 * 攜帶「原始拋出物」不做翻譯。留元件的是：toast 文案（兩面現況逐字相同，仍各自留在
 * 呼叫端）、leaveRequestErrorMessage 映射（ADR 0011）、gate 佈線（兩頁生命週期本就
 * 不同，不收）。
 *
 * deps（cancelLeaveRequest）為注入依賴，零 gate/toast import、無 svelte 元件相依、
 * 建構零副作用（SSR 安全）。 */
import { writable, type Readable } from 'svelte/store';
import type { LeaveRequest } from './leave';

/** cancelLeave() 的結果——領域 kind（非通用 ok/error，ADR 0012 判準③）；failed 攜帶
 *  原始拋出物，繁中文案由呼叫端用 leaveRequestErrorMessage() 自行映射。 */
export type CancelLeaveOutcome =
	| { kind: 'leaveCancelled'; courseName: string }
	| { kind: 'failed'; error: unknown };

export interface CancelLeaveDeps {
	/** 簽名對齊 member/leave.ts 的 cancelLeaveRequest（DELETE /leave-requests/{id}）。 */
	cancelLeaveRequest(id: string): Promise<void>;
}

export interface CancelLeave extends Readable<{ cancellingLeaveId: string | null }> {
	/** null = busy 守衛（in-flight 早退，不重複打 deps）。 */
	cancelLeave(lr: LeaveRequest): Promise<CancelLeaveOutcome | null>;
}

export function createCancelLeave(deps: CancelLeaveDeps): CancelLeave {
	let cancellingLeaveId: string | null = null;
	const store = writable<{ cancellingLeaveId: string | null }>({ cancellingLeaveId });
	const publish = (): void => store.set({ cancellingLeaveId });

	async function cancelLeave(lr: LeaveRequest): Promise<CancelLeaveOutcome | null> {
		if (cancellingLeaveId) return null;
		cancellingLeaveId = lr.id;
		publish();
		try {
			await deps.cancelLeaveRequest(lr.id);
			return { kind: 'leaveCancelled', courseName: lr.course_name };
		} catch (error) {
			return { kind: 'failed', error };
		} finally {
			cancellingLeaveId = null;
			publish();
		}
	}

	return { subscribe: store.subscribe, cancelLeave };
}
