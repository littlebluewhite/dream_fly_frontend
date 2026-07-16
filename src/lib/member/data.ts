/* Dream Fly — 會員中心 (member centre) · sample data + domain types.
 *
 * Ported verbatim from the Claude Design handoff (client/data.jsx). All copy is
 * Traditional Chinese and sampled from the source `dream_fly.pen`. This is mock
 * data with no persistence — it resets on reload, exactly like the prototype. */

/** Semantic tone shared with the Badge / ProgressBar primitives. */
import type { Tone } from '$lib/api/wire';
export type { Tone } from '$lib/api/wire';
// compat shim:目前無下游消費者;保留本 facade 的 Tone 匯出路徑(見 ADR 0007)

/* ---- single-source domain seed ----
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生 —— 值相等的 seed 常數集中在
 * `$lib/domain/member-app`；這裡 pass-through 值 + 型別(無本地用途者)，或匯入基底
 * 值後斷言回本檔案自己的型別(status/tone 欄位 member 用嚴格 Tone、domain 存寬鬆
 * string)。member 的公開 API 不變。ANNOUNCE 因兩側有一則公告的 bg 色不同，留在本
 * 檔案原地(見下方),未搬進 domain。 */
export { ME, type Member } from '$lib/domain/member-app';
export { STATS, type Stat } from '$lib/domain/member-app';
export { SKILLS, type Skill } from '$lib/domain/member-app';
// MY_COURSES(值)不在此列——Task 1(C2 死種子退役)確認這份 facade 再匯出已無
// runtime 消費者(我的課程頁走真實 getMine())後移除；EnrolledCourse interface
// 仍供 LeaveDialog 等元件的型別標註使用，繼續轉出。
export type { EnrolledCourse } from '$lib/domain/member-app';
// ATT_HISTORY 不在此列——Task F7 出勤明細改走真 GET /enrolments/{id}/attendance
// (member/api.ts 的 getEnrolmentAttendance())，這份 mock 已無 runtime 消費者。
export type { AttRecord } from '$lib/domain/member-app';
// CATALOG（課程介紹目錄）不在此列——課程介紹頁現走真實 GET /courses（member/api.ts 的
// getCourses()，回傳 $lib/public/adapters 的 CatalogCourse，非這份 domain mock），這份
// facade 再匯出已無 runtime 消費者(Task 11 P2 清理)。domain/member-app.ts 本體的
// CATALOG/CatalogCourse 隨後也經 Task 1(C2 死種子退役)確認無任何消費者後整段移除。
// MAKEUP_SLOTS 不在此列——Task 1(C2 死種子退役)確認這份 facade 再匯出已無 runtime
// 消費者後移除；MakeupSlot interface 本身也已無消費者，domain 本體一併整段退役。
export { CONTACT_THREAD, type ChatMessage } from '$lib/domain/member-app';
// REWARDS/Reward 不在此列——Task 14 把 member 的兌換品項目錄換成真 GET /rewards
// (integration-contract.md §3.23，見 member/api.ts 的 Reward/mapReward)；domain 的
// mock 常數僅供 mobile 的 PointsScreen 消費(Task 19)，故不再從這個 facade 轉出。
export { POINTS_LEDGER, type LedgerEntry } from '$lib/domain/member-app';
// LedgerType is also referenced locally (PT_TYPE below), so import it as well as re-export it.
import { type LedgerType } from '$lib/domain/member-app';
export type { LedgerType };
// status/tone-typed rows: domain stores the loose (string) shape; import the base
// value here and assert it back to this file's own stricter local interface
// (declared at its original spot below) where the const is (re-)declared.
import {
  UPCOMING as UPCOMING_BASE,
  NOTIFS_SEED as NOTIFS_SEED_BASE,
  LEAVE_STATUS as LEAVE_STATUS_BASE
} from '$lib/domain/member-app';
import { isoDateTime } from '$lib/api/wire';
import { LEVEL_TONE as LEVEL_TONE_BASE } from '$lib/domain/course-level';
import type { IconName } from '$lib/icon-registry';

export interface UpcomingClass {
  name: string;
  time: string;
  venue: string;
  coach: string;
  status: [Tone, string];
}

export type AttState = 'present' | 'leave' | 'absent';

export interface ScheduleBlock {
  day: number; // 1=Mon … 7=Sun
  start: string;
  end: string;
  name: string;
  room: string;
  coach: string;
  color: string;
  tone: Tone;
}

export interface Announcement {
  icon: IconName;
  tone: string;
  bg: string;
  title: string;
  body: string;
  time: string;
}

export interface Order {
  id: string;
  item: string;
  amount: number;
  status: [Tone, string];
  date: string;
}

export type NotifCat = 'class' | 'order' | 'coach' | 'system';
export interface Notification {
  id: string;
  cat: NotifCat;
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

/* ---- Subscriptions / entitlements (方案結帳產生的使用權) ----
 * A member gains a Subscription when a pass checks out. Truth lives on the
 * server (GET /subscriptions/me): the store is a per-session cache hydrated
 * via refreshSubscriptions — Task 17 removed the old localStorage persistence
 * (a client snapshot could out-live the real entitlement with no way to
 * invalidate it). */
export interface Subscription {
  id: string; // = the pass's cart-item id (backend product uuid)
  name: string;
  since: string;
  price: number;
}
export const SUBS_SEED: Subscription[] = [];

/* Upcoming classes (member's booked sessions) — status is Tone-typed here;
 * domain stores the loose shape, so assert back to this file's stricter type. */
export const UPCOMING: UpcomingClass[] = UPCOMING_BASE as UpcomingClass[];

/* Attendance history for the active course */
export const ATT_STATE: Record<AttState, [Tone, string]> = {
  present: ['success', '出席'],
  leave: ['info', '請假'],
  absent: ['error', '缺席']
  // 'late'(遲到)鍵已移除（Task F7）：後端 attendance_status enum(§3.12)只有
  // present/absent/leave 三值，逐堂出勤明細改走真 GET /enrolments/{id}/attendance
  // 後不會再吐出 'late'。教練點名頁的 'late' 是完全獨立的本地 UI 草稿狀態（送出時
  // 併入 'present'，見 coach/api.ts saveAttendance()），與這裡的顯示對照表無關。
};

/* 「我的請假」清單狀態 badge（Task 11；integration-contract.md §3.20 的四值
 * status）。未知值 fallback 為原字串（同 api.ts 的 ORDER_STATUS 慣例）— mine/
 * +page.svelte 用 `LEAVE_STATUS[lr.status] ?? ['neutral', lr.status]` 取值。
 * 卡 3：值升遷 $lib/domain/member-app 單源（mobile 的 MyCourseDetail 原直取本檔，
 * 改經 mobile/data facade）——這裡以本檔嚴格 [Tone, string] 對同一參照純註記收窄
 * （domain 宣告處 satisfies 明列 tone 字面聯集，NOTIFS_SEED 同型），零斷言。 */
export const LEAVE_STATUS: Record<string, [Tone, string]> = LEAVE_STATUS_BASE;

// 批次 2 W2b：LEVEL_TONE 改純註記 re-assert 自 $lib/domain/course-level（批次 1 W2a
// 已單源收斂 5 級對照）；保留本檔既有 Record<string, Tone> 寬鍵（CourseDetailDialog.svelte
// 等消費端索引值是 string）。
export const LEVEL_TONE: Record<string, Tone> = LEVEL_TONE_BASE;

/* Weekly schedule grid — member's classes */
export { WEEK } from '$lib/domain/member-app';
// SCHEDULE（值）不在此列——Task 1（C2 死種子退役）確認課表頁走真實 getSchedule()
// 後，這份 mock 已無 runtime 消費者，隨 domain/member-app.ts 本體的 SCHEDULE 一併
// 退役。ScheduleBlock interface（見上）仍供 +page.svelte 型別標註使用，不受影響。
export { TIME_ROWS } from '$lib/domain/member-app';

/* Announcements (場館公告) — kept local: mobile's 3rd item has a different `bg`. */
export const ANNOUNCE: Announcement[] = [
  { icon: 'megaphone', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '暑期特訓營開放報名', body: '7/15–8/20 競技體操暑期營，早鳥優惠至 6/30。', time: '2 天前' },
  { icon: 'calendar-off', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '端午連假停課公告', body: '6/14–6/16 全館停課，請留意補課時段。', time: '5 天前' },
  { icon: 'award', tone: 'var(--df-accent-dark)', bg: 'var(--df-accent-bg)', title: '市賽報名開始', body: '台中市體操錦標賽選手班報名開放中。', time: '1 週前' }
];

// ORDERS（帳戶訂單清單）不在此列——帳戶頁現走真實 GET /orders/me（member/api.ts 的
// getAccount()，經 mapOrder 映射回上方的 Order interface；interface 本身保留供該映射
// 使用），這份 mock 值已無 runtime 消費者(Task 11 P2 清理)。

/* Canned coach replies for the contact thread (聯絡教練 / 訊息 — 罐頭回覆;
 * CONTACT_THREAD 本體在 $lib/domain/member-app) */
export { COACH_REPLIES } from '$lib/domain/member-app';

/* Notification center (通知中心) — tone is Tone-typed here。T12 codex 終審修正:
 * 原整陣列 `as Notification[]` 會把所有欄位(含 icon: IconName)一併豁免型別檢查
 * ——domain 宣告改以 satisfies 保留 tone/icon 字面型別(見該檔宣告處註解)後,
 * 這裡用純型別註記把「同一個參照」(單源契約,domain/member-app.test.ts 以 toBe
 * 釘住——不能重建陣列)逐元素實檢收窄回本檔的嚴格 Tone,零斷言。 */
export const NOTIFS_SEED: Notification[] = NOTIFS_SEED_BASE;
export { NOTIF_CATS } from '$lib/domain/member-app';
export const NOTIF_TONE_BG: Record<string, string> = {
  primary: 'var(--df-primary-bg)',
  info: 'var(--df-info-bg)',
  success: 'var(--df-success-bg)',
  warning: 'var(--df-warning-bg)',
  accent: 'var(--df-accent-bg)'
};
export const NOTIF_TONE_FG: Record<string, string> = {
  primary: 'var(--df-primary)',
  info: 'var(--df-info)',
  success: 'var(--df-success)',
  warning: 'var(--df-warning)',
  accent: 'var(--df-accent-dark)'
};

/* ---- 通知中心：後端形狀 → 前端形狀（Task 17）----
 * 共用給 member/api.ts 的 getNotifications() 與 member/stores.ts 的
 * refreshNotifications()，放在這裡是唯一不會在兩者間造成循環 import 的位置
 * （api.ts 需要呼叫 stores.ts 的 refresh* 函式；stores.ts 不會回頭 import api.ts）。
 * 後端沒有「教練訊息」型別 → 'coach' 分類目前恆為空,是已知落差,非本次範圍。 */
export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: unknown;
  created_at: string;
}
const NOTIF_TYPE_MAP: Record<string, { cat: NotifCat; icon: IconName; tone: Tone }> = {
  booking_confirmed: { cat: 'class', icon: 'calendar-check', tone: 'success' },
  booking_cancelled: { cat: 'class', icon: 'calendar-off', tone: 'warning' },
  order_placed: { cat: 'order', icon: 'credit-card', tone: 'success' },
  order_status: { cat: 'order', icon: 'rotate-cw', tone: 'info' },
  system: { cat: 'system', icon: 'bell', tone: 'neutral' },
  promotion: { cat: 'system', icon: 'megaphone', tone: 'accent' }
};
// 未知型別 fallback：不讓頁面因後端新增 enum 值而炸掉（同 adapters.ts 的慣例）。
// icon 這個未標型別的物件屬性預設會拓寬為 string(同 cat/tone 需要 as 收窄的
// 理由)——用 as const 收窄回字面型別('bell' 本身就是合法 IconName 成員),
// 不是 as IconName 斷言。
const DEFAULT_NOTIF_META = { cat: 'system' as NotifCat, icon: 'bell' as const, tone: 'neutral' as Tone };

export function mapNotification(n: ApiNotification): Notification {
  const meta = NOTIF_TYPE_MAP[n.type] ?? DEFAULT_NOTIF_META;
  return {
    id: n.id,
    cat: meta.cat,
    icon: meta.icon,
    tone: meta.tone,
    title: n.title,
    body: n.message,
    // 後端只給絕對時間戳；mock 原本的「N 小時前」相對時間需要「現在」當基準，會讓
    // 映射變成非決定性、難以穩定測試 —— 改採簡單、可測試的絕對時間切片。
    time: isoDateTime(n.created_at),
    read: n.is_read
  };
}

/* Member points (點數明細與兌換) */
export const PT_TYPE: Record<LedgerType, [Tone, string]> = {
  earn: ['success', '獲得'],
  redeem: ['primary', '折抵'],
  expire: ['neutral', '到期']
};
