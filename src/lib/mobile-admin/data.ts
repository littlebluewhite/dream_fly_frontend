/* Dream Fly — 行動版後台 · mock data + helpers (ported from mobile-admin/data.jsx).
 *
 * Mock-only, no backend. Faithful to the prototype, including the module-load
 * augmentation the prototype did via `forEach` (campus / tier / tax / startDate …)
 * — replicated here as deterministic, index-derived `.map` builders so the output
 * is identical and SSR-safe (no Date.now / Math.random at module scope). */

export type Tone = [string, string];

/* ---- single-source domain seed ----
 * The ops-pair shared seed (coaches / classes / members / orders + venues /
 * tickets / activity + reports) lives in `$lib/domain`. Mobile re-exports the
 * pass-through datasets and imports the base arrays + helpers its own `.map`
 * projections (below) build on, so there is exactly one copy of every value.
 * Mobile's own flat types, casts, tuple `Tone`, status maps and mobile-only
 * data stay local; its public API is unchanged. */

// Pure pass-throughs — re-export domain's value + type verbatim.
export { COACHES, type Coach } from '$lib/domain/coaches';
export { VENUES, type Venue } from '$lib/domain/venues';
export { TICKETS, type Ticket } from '$lib/domain/tickets';
// Task P4-F3：報表分析(ReportsScreen.svelte)改接真 GET /reports/admin(見
// $lib/mobile-admin/api 的 getReports() 零映射 re-export)——domain/reports.ts 的
// 13 個 mock 圖表陣列/型別(CATEGORY_SPLIT/TOP_COURSES/…/COACH_PERF，含 `Split` 別名)
// 已無任何消費者，domain/reports.ts 本身隨此任務一併 `git rm`。
export type { MemberAccountStatus } from '$lib/domain/members';
// 批次 1 W2a：MemberAccountStatus 本地 union 改由 domain 轉出——`export type {…} from`
// 不引入本地作用域，本檔 MemberRow.status 仍要用到這個型別，另見下面的 import type。
// 卡 3：LEVEL_TINT 查表 + Student/StudentLevel 型別經本 seam 轉手——單一複本留在
// $lib/coach/data（單複本無分歧，搬 domain 只是搬家，ADR 0013 case-甲 同款否決），
// mobile-admin 的學員頁/StudentActionSheet 一律經這裡取用，不再直取 coach surface
// （api.ts 是 seam 本體，其對 coach/data 的型別 import 不在此列）。
export { LEVEL_TINT, type Student, type StudentLevel } from '$lib/coach/data';

// Base arrays consumed by the `.map` derivations that STAY in mobile (import, not re-export).
import { CLASSES_BASE, STATUS_TONE as STATUS_TONE_BASE } from '$lib/domain/classes';
import { MEMBERS_BASE, MEMBER_ACCOUNT_STATUS as MEMBER_ACCOUNT_STATUS_BASE, type MemberAccountStatus } from '$lib/domain/members';
import { ORDERS_BASE } from '$lib/domain/orders';
import { CAMPUSES } from '$lib/domain/shared';
import { VENUE_STATUS as VENUE_STATUS_BASE } from '$lib/domain/venues';
import { TICKET_TYPE as TICKET_TYPE_BASE } from '$lib/domain/tickets';
import type { OrderStatus } from '$lib/api/wire';
import { LEVEL_TONE as LEVEL_TONE_BASE, type Level } from '$lib/domain/course-level';
import type { IconName } from '$lib/icon-registry';

/* ---- Staff profiles (role switch) ---- */
export interface Profile {
	name: string;
	initial: string;
	role: string;
	desc: string;
	color: string;
	id: string;
}
export const PROFILES: Record<'admin' | 'coach', Profile> = {
	admin: { name: '陳怡君', initial: '陳', role: '系統管理員', desc: '可存取全平台後台', color: '#0066CC', id: 'ADM-001' },
	coach: { name: '林雅婷', initial: '林', role: '競技體操總教練', desc: '管理班級、學員出勤與訊息', color: '#0066CC', id: 'COACH-014' }
};

/* ---- Classes / 班級 ---- */
// level/status 窄化為 CLASSES_BASE(`$lib/domain/classes`)本身的字面聯集型別（同
// 桌面 admin/data.ts 的 ClassRow）——course-request.ts 的 buildCourseBody() 要求
// 這兩個窄型別，鬆散的 string 無法安全傳入。
export interface ClassRow {
	id: string;
	name: string;
	level: Level;
	cat: string;
	coach: string;
	room: string;
	day: string;
	time: string;
	enrolled: number;
	cap: number;
	age: string;
	price: number;
	status: '招生中' | '候補' | '額滿';
	wait: number;
	term: string;
	sessions: number;
	startDate: string;
	checkinRate: number;
	makeup: number;
	/** 單堂時長（分鐘，FE#18）——同桌面 admin/data.ts ClassRow.durationMinutes，
	 *  POST/PATCH /courses 的 duration_minutes 直接映射；新增/編輯流程皆收集
	 *  （見 ClassForm.svelte），Task 20 起隨真接線一併加入。 */
	durationMinutes: number;
}
export const CLASSES: ClassRow[] = CLASSES_BASE.map((k, i) => ({
	...k,
	startDate: '2026/03/' + String((i % 27) + 1).padStart(2, '0'),
	checkinRate: 86 + (i % 12),
	makeup: i % 3,
	durationMinutes: 90
}));

/* ---- Members / 學員 ----
 * Task 20：改為 GET /users 的帳號形狀（id/name/initial/phone/joined/status/
 * points）——同桌面 admin/data.ts 的 MemberAccount。桌面 admin/members 頁自己
 * 早在 Task 16 就已改吃這個「誠實、精簡」形狀（見該檔註解：MembersTable 是
 * "honest, slimmed table — no course/campus/coach/attendance/pay/tier columns
 * (P2: no backend data source)"）；行動版學員頁 / MemberSheet / MemberForm 接
 * 真 API 時一併鏡射同一個決定——舊版 course/coach/att/parent/age/pay/remain/
 * lastSeen/recent/emName/emPhone/campus/source/birthday/tier/tierColor/
 * renewDue/lineId 這些欄位在真後端從未存在過，繼續留著只會讓假資料看起來更豐富，
 * 不會讓它變真。status 由 3 態（active/warning/paused，出席率導向）改為 GET
 * /users 的 is_active 二元旗標語意（active/inactive）。MemberAccountStatus 批次
 * 1 W2a 起改由 $lib/domain/members 轉出（見檔頭 import type），本檔不再本地宣告。 */
export interface MemberRow {
	id: string;
	name: string;
	initial: string;
	phone: string;
	joined: string;
	status: MemberAccountStatus;
	points: number;
}
export const MEMBERS: MemberRow[] = MEMBERS_BASE.map((m) => ({
	id: m.id,
	name: m.name,
	initial: m.initial,
	phone: m.phone,
	joined: m.joined,
	status: m.status === 'paused' ? 'inactive' : 'active',
	points: m.points
}));

/* ---- Orders / 訂單 ---- */
// OrderStatus 單源改自 $lib/api/wire re-export(鏡射 admin/data.ts 先例，同 ADR 0007)——
// 不再本地重宣告 6 態 union。
export type { OrderStatus } from '$lib/api/wire';
export interface OrderRow {
	id: string;
	member: string;
	initial: string;
	color: string;
	item: string;
	amount: number;
	status: OrderStatus;
	method: string;
	date: string;
	invoice: string;
	discount: string;
	handler: string;
	reason?: string;
	campus: string;
	tax: number;
	net: number;
	paidAt: string;
	taxId: string;
	// Task 20：真實後端訂單 UUID（PATCH /orders/{id}/status 要用這個，不是上面顯示用
	// 的 `id`——後者其實是 order_number，同桌面 admin/data.ts Order.orderId 的附註）。
	// mock 資料沒有真實後端 id 可用，自referential 帶入即可（型別完整性用途）。
	orderId: string;
}
export const ORDERS: OrderRow[] = ORDERS_BASE.map((o, i) => ({
	...o,
	campus: CAMPUSES[i % CAMPUSES.length],
	tax: Math.round(o.amount - o.amount / 1.05),
	net: o.amount - Math.round(o.amount - o.amount / 1.05),
	paidAt: o.status === 'paid' ? o.date : o.status === 'pending' ? '—（待付款）' : o.date,
	taxId: i % 5 === 0 ? '539012' + String(40 + i).slice(0, 2) : '—',
	orderId: o.id
}));

/* ---- Today schedule (admin = all studio) ---- */
export interface TodayRow {
	time: string;
	name: string;
	coach?: string;
	room: string;
	count: number;
	tone: string;
	label: string;
	taken?: boolean;
}
// Task P4-F3：TODAY mock 退役(F11 已把 mobile-admin getAdminHome() 的今日課表改讀真
// GET /sessions/today admin 分支——見 $lib/mobile-admin/api getAdminHome()，唯一消費者
// 早已改吃 payload，此常數自 F11 起無 production 引用)。TodayRow 型別(下方 COACH_TODAY
// 與 api.ts 的映射函式仍在用)維持不動。
export const COACH_TODAY: TodayRow[] = [
	{ time: '17:00', name: '競技體操 選手班', room: 'A 訓練館', count: 12, tone: 'success', label: '進行中', taken: true },
	{ time: '19:00', name: '競技啦啦隊 進階班', room: 'A 訓練館', count: 11, tone: 'warning', label: '即將開始', taken: false }
];

/* ---- Attendance roster — 競技啦啦隊 進階班 ---- */
export interface RosterEntry {
	id: string;
	name: string;
	initial: string;
	color: string;
	mid: string;
	default: 'present' | 'late' | 'leave' | 'absent';
}
export const ROSTER: RosterEntry[] = [
	{ id: 'GY2024001', name: '王承恩', initial: '王', color: '#0066CC', mid: 'GY2024001', default: 'present' },
	{ id: 'GY2024006', name: '陳思妤', initial: '陳', color: '#EC4899', mid: 'GY2024006', default: 'present' },
	{ id: 'GY2024010', name: '蔡昀軒', initial: '蔡', color: '#F59E0B', mid: 'GY2024010', default: 'present' },
	{ id: 'GY2024013', name: '許恩綺', initial: '許', color: '#10B981', mid: 'GY2024013', default: 'leave' },
	{ id: 'GY2024014', name: '潘柏宏', initial: '潘', color: '#0EA5E9', mid: 'GY2024014', default: 'late' },
	{ id: 'GY2024015', name: '曾子涵', initial: '曾', color: '#8B5CF6', mid: 'GY2024015', default: 'present' },
	{ id: 'GY2024016', name: '葉珞晴', initial: '葉', color: '#EF4444', mid: 'GY2024016', default: 'present' },
	{ id: 'GY2024017', name: '賴宥辰', initial: '賴', color: '#0066CC', mid: 'GY2024017', default: 'absent' },
	{ id: 'GY2024018', name: '鐘語彤', initial: '鐘', color: '#F59E0B', mid: 'GY2024018', default: 'present' },
	{ id: 'GY2024019', name: '邱柏勳', initial: '邱', color: '#10B981', mid: 'GY2024019', default: 'present' },
	{ id: 'GY2024020', name: '馬欣妍', initial: '馬', color: '#EC4899', mid: 'GY2024020', default: 'present' }
];

/* ---- Coach messages / 訊息 ---- */
export interface MessageRow {
	id: string;
	from: string;
	initial: string;
	color: string;
	preview: string;
	time: string;
	unread: boolean;
}
export const MESSAGES: MessageRow[] = [
	{ id: 'm1', from: '王先生（承恩家長）', initial: '王', color: '#0066CC', preview: '教練好，承恩這週四想多留半小時練後手翻，可以嗎？', time: '10 分鐘前', unread: true },
	{ id: 'm2', from: '陳先生（思妤家長）', initial: '陳', color: '#EC4899', preview: '謝謝教練上次的動作影片，思妤回家有跟著練！', time: '1 小時前', unread: true },
	{ id: 'm3', from: '館務管理員 陳怡君', initial: '陳', color: '#0F172A', preview: 'A 訓練館本週五場地維護，請改用 B 教室。', time: '今天 09:12', unread: false },
	{ id: 'm4', from: '蔡太太（昀軒家長）', initial: '蔡', color: '#F59E0B', preview: '昀軒下週一要請假，看牙醫，謝謝教練。', time: '昨天 18:40', unread: false },
	{ id: 'm5', from: '黃媽媽（柏睿家長）', initial: '黃', color: '#8B5CF6', preview: '教練好，柏睿想暫停一個月，下個月再回來上課可以嗎？', time: '2 小時前', unread: false },
	{ id: 'm6', from: '系統通知', initial: '系', color: '#0F172A', preview: '06/15（六）全館消防演練，當日 14:00–15:00 暫停排課。', time: '昨天 10:00', unread: false },
	{ id: 'm7', from: '周先生（哲瑋家長）', initial: '周', color: '#10B981', preview: '想詢問跑酷進階班的開課時間，謝謝！', time: '昨天 09:15', unread: false },
	{ id: 'm8', from: '高媽媽（梓睿家長）', initial: '高', color: '#0066CC', preview: '梓睿這週六比賽，想跟教練確認集合時間。', time: '2 天前', unread: false },
	{ id: 'm9', from: '李太太（宥蓁家長）', initial: '李', color: '#0EA5E9', preview: '宥蓁想換到週六的班別，請問還有名額嗎？', time: '30 分鐘前', unread: true },
	{ id: 'm10', from: '周曉彤 教練', initial: '周', color: '#EC4899', preview: '青少班這週需要多一位協助老師，可以幫忙安排嗎？', time: '今天 08:40', unread: false },
	{ id: 'm11', from: '武先生（品妍家長）', initial: '武', color: '#10B981', preview: '品妍的體驗券快到期了，想直接報名律動班。', time: '昨天 17:20', unread: false },
	{ id: 'm12', from: '系統通知', initial: '系', color: '#0F172A', preview: '06/20（六）夏季成果發表會開始售票，請協助於官網公告。', time: '2 天前', unread: false }
];

/* ---- Activity feed ---- */
// Task P4-F3：ACTIVITY mock 退役(F11 已把 mobile-admin getAdminHome() 的最新動態改讀
// 真 GET /reports/admin/activity——見 $lib/mobile-admin/api getAdminHome()，唯一消費者
// 早已改吃 payload，此值與其 `Activity` 型別重新匯出自 F11 起無 production 引用)。
// ActivityRow(下方 api.ts 仍在用的型別別名)只做型別匯入 + 更名，不再連帶匯出 mock 值。
import type { Activity as ActivityRowType } from '$lib/domain/activity';
export type ActivityRow = ActivityRowType;

/* ---- Notifications (mobile bell) ---- */
export interface AdminNotif {
	icon: IconName;
	tone: string;
	bg: string;
	title: string;
	body: string;
	time: string;
	read: boolean;
}
export const ADMIN_NOTIFS: AdminNotif[] = [
	{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '新會員報名', body: '謝佩珊 完成報名兒童基礎 B 班', time: '12 分鐘前', read: false },
	{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', title: '收款成功', body: '訂單 DF-24061 已付款 NT$4,800', time: '38 分鐘前', read: false },
	{ icon: 'user-x', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '出席偏低警示', body: '張宇辰 出席率降至 76%，建議聯繫家長', time: '1 小時前', read: false },
	{ icon: 'rotate-ccw', tone: 'var(--df-text-light)', bg: 'var(--df-bg-light)', title: '訂單退款', body: '訂單 DF-24057 已退款 NT$600', time: '3 小時前', read: true }
];
export const COACH_NOTIFS: AdminNotif[] = [
	{ icon: 'calendar-check', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '點名提醒', body: '19:00 競技啦啦隊 進階班 尚未完成點名', time: '5 分鐘前', read: false },
	{ icon: 'message-circle', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '王先生（承恩家長）', body: '教練您好，承恩這週四想多留半小時…', time: '10 分鐘前', read: false },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', title: '評核待更新', body: '選手班 3 位學員技能評量待更新', time: '昨天 16:05', read: true }
];

// Task 20：MemberAccountStatus 專用（GET /users 的 is_active 布林值）——語意跟舊 3 態
// （出席率導向）不同，同桌面 admin/data.ts 的 MEMBER_ACCOUNT_STATUS 標籤。批次 1 W2a：
// MEMBER_STATUS 改名 MEMBER_ACCOUNT_STATUS（消同名異義——本檔已無 3 態版 MEMBER_STATUS
// 需要區分），改純註記 re-assert 自 $lib/domain/members，本檔只保留 tuple Tone 可見型別。
export const MEMBER_ACCOUNT_STATUS: Record<MemberAccountStatus, Tone> = MEMBER_ACCOUNT_STATUS_BASE;
// 批次 1 W2a：LEVEL_TONE/STATUS_TONE 改純註記 re-assert 自 $lib/domain，保留本檔既有
// Record<string, …> 可見型別（LevelBadge.svelte 等消費端吃鬆散 string，需要寬鍵）。
export const LEVEL_TONE: Record<string, string> = LEVEL_TONE_BASE;
export const STATUS_TONE: Record<string, string> = STATUS_TONE_BASE;

// Task P4-F3：報表分析 mock 全面退役——KPI 卡(REPORT_KPIS/Kpi)、營收趨勢
// (REVENUE_TREND)、本月營收來源拆解(REVENUE_TOTAL/REVENUE_BREAKDOWN)原本這裡的三組
// 常數，隨 ReportsScreen.svelte 接真 GET /reports/admin 一併移除(唯一消費者已改吃
// getReports() payload；見 $lib/mobile-admin/api 的 getReports() 與 report-math.ts)。

/* ===== 場館管理 data ===== */
// `Venue` + `VENUES` are re-exported from `$lib/domain/venues` (top of file).
// 批次 1 W2a：改純註記 re-assert 自 $lib/domain/venues；canonical 標籤同步改為
// 「可預約」，取代本檔舊值「可使用」——兩者原意相同、字面各自維護導致靜默發散，
// 見 ADR 0013。
export const VENUE_STATUS: Record<string, Tone> = VENUE_STATUS_BASE;

/* ===== 票券管理 data ===== */
// `Ticket` + `TICKETS` are re-exported from `$lib/domain/tickets` (top of file).
export const TICKET_TYPE: Record<string, Tone> = TICKET_TYPE_BASE;
