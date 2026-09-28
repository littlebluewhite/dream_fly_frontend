/* src/lib/domain/leave-requests.ts — 請假列 view-model single source of truth（Task 10）
 *
 * member 桌面（routes/member/mine/+page.svelte）與 mobile（$lib/mobile/overlays/
 * MyCourseDetail.svelte）兩處「我的請假」列表原本各自手抄同一條 tone/label 查表
 * （原 LEAVE_STATUS，經 domain/member-app.ts 轉出）、同一段 when/makeupWhen
 * 格式化呼叫，以及 Task 6 已收斂的動作規則——三者其實是同一列資料的同一份 view-
 * model，逐字分歧只在觸發元件（button vs sheet、桌面 Button 元件 vs mobile 原生
 * button），單源收斂到這裡的 `leaveRow()`；`leaveAction` 改為本檔私有實作細節，
 * 不再對外匯出。補課開啟方式（Dialog vs sheet）與 toast 文案仍各自留在呼叫端
 * （ADR 0011/0012）。
 *
 * `makeupWhen` 缺漏時回傳 null（而非呼叫端原本 `?? ''` 後援餵給
 * formatSessionDateTime 產生的「已預約補課： (undefined)」）——呼叫端據此判斷是否
 * 渲染這一行。 */

import type { Tone } from '$lib/api/wire';
import { formatSessionDateTime } from './session-format';

/** 請假申請狀態（integration-contract.md §3.20 四態）。 */
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** 一筆請假紀錄可觸發的動作：'cancel'（可取消，pending）、'bookMakeup'（可預約補課，
 *  approved 且未補課）、'makeupBooked'（已補課，僅顯示不可操作）、null（rejected /
 *  cancelled，無動作）。 */
export type LeaveAction = 'cancel' | 'bookMakeup' | 'makeupBooked' | null;

/** 請假動作推導：status 為 pending → cancel；approved 且有 makeup_session_id →
 *  makeupBooked；approved 且無 makeup_session_id → bookMakeup；其餘（rejected /
 *  cancelled）→ null。私有——呼叫端一律經 `leaveRow()` 取得。 */
function leaveAction(lr: { status: LeaveStatus; makeup_session_id: string | null }): LeaveAction {
	if (lr.status === 'pending') return 'cancel';
	if (lr.status === 'approved') return lr.makeup_session_id ? 'makeupBooked' : 'bookMakeup';
	return null;
}

/** 狀態 → tone/label 顯示查表（前身 domain/member-app.ts 的 `LEAVE_STATUS`，經
 *  member/mobile 兩側 facade 各自收窄轉出；Task 10 兩側 facade 退役，單源收進這裡，
 *  不再對外匯出——`leaveRow()` 是唯一讀者）。 */
const STATUS_BADGE: Record<LeaveStatus, [Tone, string]> = {
	pending: ['warning', '待審核'],
	approved: ['success', '已核准'],
	rejected: ['error', '已婉拒'],
	cancelled: ['neutral', '已取消']
};

/** `leaveRow()` 的輸入形狀——member `LeaveRequest` 的子集，鴨型別相容，呼叫端毋須
 *  額外轉換。 */
export interface LeaveRowSource {
	status: LeaveStatus;
	session_date: string;
	start_time: string;
	makeup_session_id: string | null;
	makeup_session_date: string | null;
	makeup_start_time: string | null;
}

/** 「我的請假」單列 view-model：`tone`/`label` 是狀態 badge；`when` 是本次請假場次
 *  的日期時間文字；`makeupWhen` 是已預約補課場次的日期時間文字，補課日期或時間任一
 *  缺漏時為 `null`（呼叫端據此判斷是否渲染這一行，而非硬塞空字串）；`action` 是本列
 *  可觸發的動作。 */
export interface LeaveRow {
	tone: Tone;
	label: string;
	when: string;
	makeupWhen: string | null;
	action: LeaveAction;
}

export function leaveRow(lr: LeaveRowSource): LeaveRow {
	const [tone, label] = STATUS_BADGE[lr.status] ?? ['neutral', lr.status];
	return {
		tone,
		label,
		when: formatSessionDateTime(lr.session_date, lr.start_time),
		makeupWhen:
			lr.makeup_session_date && lr.makeup_start_time
				? formatSessionDateTime(lr.makeup_session_date, lr.makeup_start_time)
				: null,
		action: leaveAction(lr)
	};
}
