/* Dream Fly — 今日課表場次狀態 single source of truth（C4）
 *
 * admin/coach/mobile-admin 三處原本各自手抄一份「場次狀態 → tone/中文標籤」查表，字面
 * 已經分歧（admin 的 live 是「進行中」、coach/mobile-admin 是「上課中」）——單源收斂到
 * 這裡，正字＝「上課中」（見 SESSION_STATUS.live）。場次狀態由後端推導（W-5：
 * TodaySessionResponse.status，工作室牆鐘時間），前端只做 wire 值 → UI 鍵的對應，不再
 * 自行比較時間。 */
import type { SessionStatus, Tone, TodaySessionResponse } from '$lib/api/wire';
import { hhmm } from '$lib/api/wire';

/** 今日場次狀態 union（admin/coach/mobile-admin 共用查表鍵，自 coach/data.ts 升遷）。 */
export type TodayStatus = 'wait' | 'live' | 'done';

/** 場次狀態 → [Tone, 中文標籤]。canonical 標籤——live 是「上課中」，不是 admin 舊值
 *  「進行中」（語意相同但字面各自維護導致靜默發散，隨本次單源收斂統一）。 */
export const SESSION_STATUS: Record<TodayStatus, [Tone, string]> = {
	wait: ['neutral', '尚未開始'],
	live: ['success', '上課中'],
	done: ['neutral', '已結束']
};

/** 後端 SessionStatus → UI 狀態鍵。Record 窮舉：bindings 同步後新增值域是編譯錯誤；
 *  後端先上線、前端未同步時的未知值在 toTodaySession 退回 'wait'（不讓下游查表 throw）。 */
const TODAY_STATUS: Record<SessionStatus, TodayStatus> = {
	upcoming: 'wait',
	ongoing: 'live',
	done: 'done'
};

/** 今日場次投影（C5：wire 形狀 TodaySessionResponse 由後端產生）。production
 *  呼叫端是 admin/api.ts 的 mapTodaySession（mobile-admin 的 admin 分支經它取得
 *  state）與 coach/api.ts 的 mapTodayClass/mapAttendanceClass（R13 終審收斂，見
 *  docs/adr/0023）——coach 兩支 mapper 目標形狀另帶 level/cat 等欄位，疊在本函式的
 *  投影結果上，不再自行重算 hhmm/venue 預設值/狀態。
 *  coach_name/venue 為 null 時皆給
 *  '—'（誠實預設值，P2：後端無對應資料時的既有慣例）；state 直接對應後端 status。 */
export interface TodaySession {
	id: string;
	start: string;
	end: string;
	name: string;
	coach: string;
	room: string;
	count: number;
	state: TodayStatus;
}

export function toTodaySession(s: TodaySessionResponse): TodaySession {
	return {
		id: s.id,
		start: hhmm(s.start_time),
		end: hhmm(s.end_time),
		name: s.course_name,
		coach: s.coach_name ?? '—',
		room: s.venue ?? '—',
		count: s.enrolled_count,
		state: TODAY_STATUS[s.status] ?? 'wait'
	};
}
