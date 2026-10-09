/* Dream Fly — 出勤狀態顯示查表 (single source of truth)
 * member（routes/member/mine）與 mobile（MyCourseDetail）兩側原本各自一份同字面的三值 ATT_STATE，
 * 收斂到這裡；消費端只呼叫 attStateBadge（ADR 0013 R19 增補：後端 enum 當鍵的查表，未知值後備收在查表所在檔）。 */

import type { Tone } from '$lib/api/wire';
import type { AttendanceStatus } from '$lib/api/generated';

/** 出勤狀態 → [Tone, 中文標籤]。鍵為生成型別：後端 attendance_status 多一個值、bindings 同步後少鍵即編譯錯誤。 */
export const ATT_STATE: Record<AttendanceStatus, [Tone, string]> = {
	present: ['success', '出席'],
	leave: ['info', '請假'],
	absent: ['error', '缺席']
};

/** 容忍未知字串的出勤狀態查表：查無（只認自有鍵）→ ['neutral', 原字串]。寫法同 tickets.ts 的 ticketTypeBadge，
 *  後端多一個出勤狀態時不會 destructure 到 undefined 而炸頁。 */
export const attStateBadge = (s: string): [Tone, string] =>
	Object.hasOwn(ATT_STATE, s) ? (ATT_STATE as Record<string, [Tone, string]>)[s] : ['neutral', s];
