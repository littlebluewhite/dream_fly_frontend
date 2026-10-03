/* Dream Fly — 會員中心 (member centre) · sample data + domain types.
 *
 * Ported verbatim from the Claude Design handoff (client/data.jsx). All copy is
 * Traditional Chinese and sampled from the source `dream_fly.pen`. This is mock
 * data with no persistence — it resets on reload, exactly like the prototype. */

/** Semantic tone shared with the Badge / ProgressBar primitives. */
import type { Tone } from '$lib/api/wire';

/* ---- single-source domain seed ----
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生 —— 值相等的 seed 常數集中在
 * `$lib/domain/member-app`。ANNOUNCE 因兩側有一則公告的 bg 色不同，留在本檔案原地
 * (見下方),未搬進 domain。 */
// C4 批2(facade 純轉手退役):ME/type Member、STATS/type Stat、SKILLS/type Skill、
// EnrolledCourse、AttRecord、CONTACT_THREAD/type ChatMessage、POINTS_LEDGER/type
// LedgerEntry、WEEK、TIME_ROWS、COACH_REPLIES、NOTIF_CATS(下方「Notification
// center」段落)十一組 domain/member-app 純轉手匯出——不攜帶本檔型別事實、不做值
// 變形——整批退役;消費端改直取 $lib/domain/member-app 同名同型符號(本批兩側符號
// 名一致,無改名,故無 import-site alias)。LedgerType 型別本檔仍在內部使用(PT_TYPE
// 下方),保留 import、拿掉對外轉出。UPCOMING 不在此列——
// 匯入基底值後純註記收窄回本檔案自己較嚴格的型別(status/tone 欄位 member 用
// 嚴格 Tone、domain 存寬鬆 string),攜帶本檔型別事實,繼續保留。
// LEAVE_STATUS(原同列續存的收窄 facade)於 Task 10(架構深化 R15·請假列 view-model)
// 退役:tone/label 查表併入動作規則、when/makeupWhen 格式化,單源收斂進
// `domain/leave-requests.ts` 的 `leaveRow()`,消費端(mine/+page.svelte)改直取。
// NOTIFS_SEED(原同列續存的收窄 facade)於 R14 候選 F3 退役:通知 store 誠實開機為 `[]`,
// 種子已無 production 讀者,值逐字搬進測試專用的 $lib/testing/seed-fixtures(ADR 0010)。
// CATALOG（課程介紹目錄）不在此列——課程介紹頁現走真實 GET /courses（member/api.ts 的
// getCourses()，回傳 $lib/public/adapters 的 CatalogCourse，非這份 domain mock），這份
// facade 再匯出已無 runtime 消費者(Task 11 P2 清理)。domain/member-app.ts 本體的
// CATALOG/CatalogCourse 隨後也經 Task 1(C2 死種子退役)確認無任何消費者後整段移除。
// MAKEUP_SLOTS 不在此列——Task 1(C2 死種子退役)確認這份 facade 再匯出已無 runtime
// 消費者後移除；MakeupSlot interface 本身也已無消費者，domain 本體一併整段退役。
// REWARDS/Reward 不在此列——Task 14 把 member 的兌換品項目錄換成真 GET /rewards
// (integration-contract.md §3.23，見 member/api.ts 的 Reward/mapReward)；domain 的
// mock 常數僅供 mobile 的 PointsScreen 消費(Task 19)，故不再從這個 facade 轉出。
import { type LedgerType } from '$lib/domain/member-app';
// status/tone-typed rows: domain stores the loose (string) shape; import the base
// value here and assert it back to this file's own stricter local interface
// (declared at its original spot below) where the const is (re-)declared.
import { UPCOMING as UPCOMING_BASE } from '$lib/domain/member-app';
import { isoDateTime } from '$lib/api/wire';
import { LEVEL_TONE as LEVEL_TONE_BASE } from '$lib/domain/course-level';
import type { IconName } from '$lib/icon-registry';
import type { NotificationResponse, NotificationType } from '$lib/api/generated';

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
  // 後不會再吐出 'late'。
};

// 批次 2 W2b：LEVEL_TONE 改純註記 re-assert 自 $lib/domain/course-level（批次 1 W2a
// 已單源收斂 5 級對照）；保留本檔既有 Record<string, Tone> 寬鍵（CourseDetailDialog.svelte
// 等消費端索引值是 string）。
export const LEVEL_TONE: Record<string, Tone> = LEVEL_TONE_BASE;

// SCHEDULE（值）不在此列——Task 1（C2 死種子退役）確認課表頁走真實 getSchedule()
// 後，這份 mock 已無 runtime 消費者，隨 domain/member-app.ts 本體的 SCHEDULE 一併
// 退役。ScheduleBlock interface（見上）仍供 +page.svelte 型別標註使用，不受影響。

/* Announcements (場館公告) — kept local: mobile's 3rd item has a different `bg`. */
export const ANNOUNCE: Announcement[] = [
  { icon: 'megaphone', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '暑期特訓營開放報名', body: '7/15–8/20 競技體操暑期營，早鳥優惠至 6/30。', time: '2 天前' },
  { icon: 'calendar-off', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '端午連假停課公告', body: '6/14–6/16 全館停課，請留意補課時段。', time: '5 天前' },
  { icon: 'award', tone: 'var(--df-accent-dark)', bg: 'var(--df-accent-bg)', title: '市賽報名開始', body: '台中市體操錦標賽選手班報名開放中。', time: '1 週前' }
];

// ORDERS（帳戶訂單清單）不在此列——帳戶頁現走真實 GET /orders/me（member/api.ts 的
// getAccount()，經 mapOrder 映射回上方的 Order interface；interface 本身保留供該映射
// 使用），這份 mock 值已無 runtime 消費者(Task 11 P2 清理)。

/* Notification center (通知中心) — tone 色票查表。 */
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
 * 唯一消費者是 member/notifications.ts 通知閘門的 fetch(hydrateNotifications 與通知頁
 * 進場包共用；member 與 mobile 自 R12 起共用這一個通知 module)。原本另一個消費者
 * member/api.ts 的 getNotifications() 已於 R12 退役(零 production 呼叫端)。
 * 後端沒有「教練訊息」型別 → 'coach' 分類目前恆為空,是已知落差,非本次範圍。 */
const NOTIF_TYPE_MAP: Record<NotificationType, { cat: NotifCat; icon: IconName; tone: Tone }> = {
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

export function mapNotification(n: NotificationResponse): Notification {
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
  adjust: ['neutral', '調整'],
  refund: ['info', '退款']
};
