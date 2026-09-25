/* src/lib/domain/leave-requests.ts — 請假動作規則 single source of truth（Task 6）
 *
 * member 桌面（routes/member/mine/+page.svelte）與 mobile（$lib/mobile/overlays/
 * MyCourseDetail.svelte）兩處「我的請假」列表原本各自手抄同一條 pending/approved
 * 分支規則，字面雖分歧（button vs sheet 觸發、桌面用 Button 元件、mobile 用原生
 * button）但規則本身逐字相同——單源收斂到這裡。補課開啟方式（Dialog vs sheet）與
 * toast 文案仍各自留在呼叫端（ADR 0011/0012）。 */

/** 一筆請假紀錄可觸發的動作：'cancel'（可取消，pending）、'bookMakeup'（可預約補課，
 *  approved 且未補課）、'makeupBooked'（已補課，僅顯示不可操作）、null（rejected /
 *  cancelled，無動作）。 */
export type LeaveAction = 'cancel' | 'bookMakeup' | 'makeupBooked' | null;

/** 請假動作推導：status 為 pending → cancel；approved 且有 makeup_session_id →
 *  makeupBooked；approved 且無 makeup_session_id → bookMakeup；其餘（rejected /
 *  cancelled）→ null。 */
export function leaveAction(lr: { status: string; makeup_session_id: string | null }): LeaveAction {
	if (lr.status === 'pending') return 'cancel';
	if (lr.status === 'approved') return lr.makeup_session_id ? 'makeupBooked' : 'bookMakeup';
	return null;
}
