/* Dream Fly — 今日課表場次狀態 single source of truth（C4）
 *
 * admin/coach/mobile-admin 三處原本各自手抄一份「場次狀態 → tone/中文標籤」查表，字面
 * 已經分歧（admin 的 live 是「進行中」、coach/mobile-admin 是「上課中」）——單源收斂到
 * 這裡，正字＝「上課中」（見 SESSION_STATUS.live）。deriveSessionStatus（§3.18 裁決 2：
 * 場次時間為牆鐘語意，前端以本地時間直接比較，不做時區換算）與其私有的 wallClockTime
 * 亦自 coach/api.ts 整段移入（語意零改）——coach/api.ts 只留 re-export，admin/api.ts 改
 * 直接從這裡 import，消除原本 admin → coach 的跨 surface 借實作。 */
import type { Tone } from '$lib/api/wire';

/** 今日場次狀態 union（admin/coach/mobile-admin 共用查表鍵，自 coach/data.ts 升遷）。 */
export type TodayStatus = 'wait' | 'live' | 'done' | 'soon';

/** 場次狀態 → [Tone, 中文標籤]。canonical 標籤——live 是「上課中」，不是 admin 舊值
 *  「進行中」（語意相同但字面各自維護導致靜默發散，隨本次單源收斂統一）。 */
export const SESSION_STATUS: Record<TodayStatus, [Tone, string]> = {
	wait: ['neutral', '尚未開始'],
	live: ['success', '上課中'],
	done: ['neutral', '已結束'],
	soon: ['warning', '即將開始']
};

/** now 轉為本地牆鐘 "HH:MM:SS"，供與 start_time/end_time 直接字典序比較(§3.18 裁決 2：
 *  場次時間為牆鐘語意，前端以本地時間直接比較，不做時區換算)。 */
function wallClockTime(now: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/** 場次狀態推導：now < start_time → 'wait'；start_time ≤ now < end_time → 'live'；
 *  now ≥ end_time → 'done'。now 由呼叫端傳入的純函式，不吃系統時鐘，獨立可測。 */
export function deriveSessionStatus(startTime: string, endTime: string, now: Date): TodayStatus {
	const wall = wallClockTime(now);
	if (wall < startTime) return 'wait';
	if (wall < endTime) return 'live';
	return 'done';
}
