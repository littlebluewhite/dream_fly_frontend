/* Dream Fly — 管理後台 · shared data, types + derivations
 * Ported from the admin handoff source (docs/design/admin/data.jsx). The React
 * source enriches base arrays by mutation (forEach); here we translate that to
 * immutable `.map((x,i) => ({...x, derived}))` so the exported arrays are fully
 * materialised and strictly typed (a missing derivation is a compile error). */

/* ───────────────────────── unions ───────────────────────── */
import type { Tone } from '$lib/api/wire';
export type { Tone, OrderStatus } from '$lib/api/wire';
// 活 facade:StatusBadge/OrdersTable/orders-filter 等經本檔取得 Tone/OrderStatus/ORDER_STATUS(來源=$lib/api/wire,見 ADR 0007)
import { LEVELS, type Level } from '$lib/domain/course-level';
export { LEVELS };
export type { Level };
// 活 facade:course-request.ts/ClassEditDialog.svelte/StatusBadge.svelte 等經本檔取得 LEVELS/Level(來源=$lib/domain/course-level,FE#17)

export type MemberStatus = 'active' | 'warning' | 'paused';
export type PayStatus = 'paid' | 'due' | 'trial';
export type AttMark = 'p' | 'a' | 'l' | 'v';
export type TicketType = 'ticket' | 'membership' | 'course_package';
export type VenueStatus = 'available' | 'maintenance';
export type ClassStatus = '招生中' | '候補' | '額滿';
export type TodayState = 'done' | 'prep' | 'live' | 'soon' | 'wait';

/* ───────────────────────── single-source domain seed ─────────────────────────
 * The seed (coaches/classes/members/orders + venues/tickets/activity + reports)
 * lives in `$lib/domain`. Admin re-exports the pass-through datasets and imports
 * the base arrays + helpers that its `.map` enrichments (below) build on, so there
 * is exactly one copy of every value. Admin's public API is unchanged. */

// Pure pass-throughs (no local use) — re-export domain's value + type verbatim.
// TEST-FIXTURE ONLY(無 runtime 消費者)——僅供測試 fixture 使用,勿在頁面/元件 import
export { COACHES, type Coach } from '$lib/domain/coaches';

/** CoachEditDialog（新增/編輯共用一個對話框，Task F5）的 onSave 輸出形狀——UI 端草稿,
 *  不是 wire body。呼叫端(routes/admin/coaches/+page.svelte)依新增/編輯模式，各自把
 *  這份草稿拆成 createMember/createCoach 或 updateMember/updateCoach 的實際 body：
 *  email/password 只在新增模式(isNew)有意義(POST /users)，編輯模式下維持空字串、
 *  呼叫端不會讀取。name 編輯模式若有變動才觸發 PATCH /users/{user_id}；
 *  title/tags(=specialties)/isActive(=coaches.is_active)兩種模式皆會送出。 */
export interface CoachFormValues {
	email: string;
	password: string;
	name: string;
	title: string;
	tags: string[];
	isActive: boolean;
}
// TEST-FIXTURE ONLY(無 runtime 消費者)——僅供測試 fixture 使用,勿在頁面/元件 import
export { VENUES, type Venue } from '$lib/domain/venues';
// TEST-FIXTURE ONLY(無 runtime 消費者)——僅供測試 fixture 使用,勿在頁面/元件 import
export { TICKETS, type Ticket } from '$lib/domain/tickets';
// Task F11：ACTIVITY live-mock 退役(唯一消費者 ActivityPanel 改吃 props；真資料見
// admin/api.ts 的 getRecentActivity()，對應 GET /reports/admin/activity，integration-
// contract.md §3.24)。型別仍為 ActivityPanel props 的形狀來源，保留 re-export。
export type { Activity } from '$lib/domain/activity';
// Task 15: admin's report analytics (getReports()) now maps GET /reports/admin
// (integration-contract.md §3.24) instead of this mock seed — the re-export of
// domain/reports.ts's 13 arrays/types was dropped here (nothing in admin/ imports
// them anymore). Task P4-F3: mobile-admin/data.ts's own re-export of it (the last
// remaining consumer) was retired the same way once ReportsScreen.svelte wired to
// real data — domain/reports.ts itself is now `git rm`'d, no surface still uses it.

// Base arrays consumed by the `.map` derivations that STAY in admin (import, not re-export).
import type { ClassBase } from '$lib/domain/classes';
import type { MemberBase } from '$lib/domain/members';
import type { OrderBase } from '$lib/domain/orders';
import { initialOf } from '$lib/api/wire';
// Task 1(C2 死種子退役):tierOf 轉出與其唯一消費者一併退役(唯一消費者是
// data.test.ts 自己的直接單元測試,無 production 呼叫端)——`$lib/domain/shared`
// 本體的 tierOf 定義同批移除,CAMPUSES 是這裡唯一還在用的值,但也僅供已退役的
// CLASSES/ORDERS 衍生使用,一併不再從這裡 import。

/* ───────────────────────── classes ───────────────────────── */
export interface ClassRow extends ClassBase {
	startDate: string;
	checkinRate: number;
	makeup: number;
	/** 單堂時長（分鐘，FE#18）——後端 duration_minutes 的直接映射；新增流程必填，
	 *  編輯流程也可調整（見 ClassEditDialog）。 */
	durationMinutes: number;
}
// Task 1(C2 死種子退役):CLASSES(CLASSES_BASE 的 .map 衍生)已退役——唯一消費者是
// data.test.ts/元件測試,已改為各測試檔內的 inline ClassRow fixture。ClassRow
// interface 仍供 classes/+page.svelte 與眾多元件的型別標註使用,保留。

/* ───────────────────────── members ───────────────────────── */
export interface Member extends MemberBase {
	campus: string;
	source: string;
	birthday: string;
	tier: string;
	tierColor: string;
	renewDue: string;
	lineId: string;
}

/* ───────────────────────── members：GET /users 映射（Task 18） ─────────────────────────
 * MEMBERS／MEMBERS_BASE 已於 Task 11 P2 清理移除——唯一消費者是 data.test.ts，學員管理頁
 * MembersTable 走的是下面這組真實 GET /users 映射，早就不吃那份 mock seed；Member
 * interface 保留在上面供 MemberDialog 使用。這裡另外的「從真實 GET /users 回應映射」型別
 * ＋函式，供 api.ts 的 getMembers() 使用 —— GET /users 是通用帳號端點，只有 id/name/
 * phone/is_active/points_balance/created_at 這類帳號欄位，沒有課程/教練/出席/繳費/
 * 緊急聯絡人等健身房專屬資料，因此輸出型別是 Member 的一個小子集（MemberAccount），
 * 而非硬塞成完整 Member。 */

/** `GET /users`（admin）單筆使用者的 wire 形狀（僅本次映射用到的欄位）。 */
export interface ApiUserAccount {
	id: string;
	name: string;
	phone: string | null;
	created_at: string;
	is_active: boolean;
	points_balance: number;
}

/** 帳號啟用狀態 —— GET /users 只有 is_active 這個二元旗標，跟既有 MemberStatus
 *  （active/warning/paused，出席率導向）語意不同，不強塞成同一個型別。 */
export type MemberAccountStatus = 'active' | 'inactive';

export interface MemberAccount {
	id: string;
	name: string;
	initial: string;
	phone: string;
	joined: string;
	status: MemberAccountStatus;
	points: number;
}

/** `GET /users` → 學員名單所需欄位映射（id/name/initial/phone/joined/status/points）。 */
export function mapMemberAccount(u: ApiUserAccount): MemberAccount {
	return {
		id: u.id,
		name: u.name,
		initial: initialOf(u.name),
		phone: u.phone ?? '',
		joined: u.created_at.slice(0, 10),
		status: u.is_active ? 'active' : 'inactive',
		points: u.points_balance
	};
}

/* ───────────────────────── orders ───────────────────────── */
export interface Order extends OrderBase {
	campus: string;
	tax: number;
	net: number;
	paidAt: string;
	taxId: string;
	// Task 8 piece 2: 真實後端訂單 UUID（PATCH /orders/{id}/status 要用這個，不是
	// 上面顯示用的 `id`——後者其實是 order_number，見 admin/api.ts 的 mapAdminOrder）。
	// mock 資料沒有真實後端 id 可用，自referential 帶入即可（型別完整性用途）。
	orderId: string;
}
// Task 1(C2 死種子退役):ORDERS(ORDERS_BASE 的 .map 衍生)已退役——唯一消費者是
// data.test.ts/元件測試,已改為各測試檔內的 inline Order fixture。Order interface
// 仍供 orders/+page.svelte 與眾多元件的型別標註使用,保留。

/* ───────────────────────── status maps (shapes differ!) ───────────────────────── */
/** [Tone, label] tuples. */
export const MEMBER_STATUS: Record<MemberStatus, [Tone, string]> = {
	active: ['success', '在學中'],
	warning: ['warning', '出席偏低'],
	paused: ['neutral', '暫停中']
};
/** MemberAccount 專用（GET /users 的 is_active 布林值）——語意跟 MemberStatus（出席率
 *  導向的三態）不同，不能共用同一份 lookup，故獨立一份。 */
export const MEMBER_ACCOUNT_STATUS: Record<MemberAccountStatus, [Tone, string]> = {
	active: ['success', '啟用中'],
	inactive: ['neutral', '已停用']
};
export const PAY_STATUS: Record<PayStatus, [Tone, string]> = {
	paid: ['success', '已繳清'],
	due: ['warning', '待續費'],
	trial: ['info', '體驗中']
};
export { ORDER_STATUS } from '$lib/api/wire';
export const VENUE_STATUS: Record<VenueStatus, [Tone, string]> = {
	available: ['success', '可預約'],
	maintenance: ['warning', '維護中']
};
export const TICKET_TYPE: Record<TicketType, [Tone, string]> = {
	ticket: ['accent', '單次票券'],
	membership: ['primary', '月票方案'],
	course_package: ['success', '課程套裝']
};
/** ⚠ raw hex colour + label (NOT a Tone) — used for the 6-dot attendance strip. */
export const ATT_MARK: Record<AttMark, [string, string]> = {
	p: ['#10B981', '出'],
	a: ['#EF4444', '缺'],
	l: ['#F59E0B', '遲'],
	v: ['#94A3B8', '假']
};
/** plain Tone lookups. */
export const LEVEL_TONE: Record<Level, Tone> = {
	啟蒙: 'info',
	入門: 'info',
	基礎: 'primary',
	進階: 'warning',
	選手: 'accent'
};
export const STATUS_TONE: Record<ClassStatus, Tone> = {
	招生中: 'success',
	候補: 'warning',
	額滿: 'neutral'
};

/* ───────────────────────── form constants ───────────────────────── */
export const CATS: string[] = ['競技體操', '競技啦啦隊', '兒童基礎', '幼兒體操', '成人體操', '跑酷'];
export const CLASS_STATUS: ClassStatus[] = ['招生中', '候補', '額滿'];
/** Ticket type union as a 新增/編輯票券 Select source (keys of TICKET_TYPE). */
export const TICKET_TYPES: TicketType[] = ['ticket', 'membership', 'course_package'];
/** Venue status union as a 新增/編輯場地 Select source (keys of VENUE_STATUS). */
export const VENUE_STATUSES: VenueStatus[] = ['available', 'maintenance'];
export const MEMBER_COLORS: string[] = ['#0066CC', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444'];

/* ───────────────────────── today schedule (admin) ───────────────────────── */
export interface TodayClass {
	time: string;
	name: string;
	coach: string;
	room: string;
	count: number;
	state: TodayState;
	tone: Tone;
	label: string;
}
// Task F11：TODAY live-mock 退役(唯一消費者 TodayPanel 改吃 props；真資料見 admin/api.ts
// 的 getTodaySessions()，對應 GET /sessions/today admin 分支，integration-contract.md
// §3.18)。TodayState 5 態聯集維持不窄化——真資料的 deriveSessionStatus()(coach/api.ts
// 復用)只會推導 wait/live/done 3 態，'prep'/'soon' 兩個緩衝態不會再被產生，但保留超集
// 型別可讓真資料的 3 態直接指派、不需額外 cast。

/* ───────────────────────── activity / venues / tickets ─────────────────────────
 * `COACHES`, `VENUES`, `TICKETS` are re-exported from `$lib/domain` at the top
 * (`Activity` type only — see Task F11 note above). */

/* ═════════════════════════ 報表分析 ═════════════════════════
 * Task 15: getReports() now maps real GET /reports/admin data (revenue/members/
 * courses/coaches — integration-contract.md §3.24); the old mock KPI band/revenue
 * breakdown/trend seed (REPORT_KPIS/REVENUE_BREAKDOWN/REVENUE_TOTAL/REVENUE_TREND)
 * and the domain/reports.ts re-export (CATEGORY_SPLIT 等 13 組) have no backend data
 * source and were removed from the UI along with their chart components (裁決 9).
 * `TrendBar` survives — RevenueTrend.svelte still renders it, now fed real
 * ntd()-converted monthly revenue via admin/api.ts's getReports(). */
export interface TrendBar {
	m: string;
	h: number;
	peak?: boolean;
}
