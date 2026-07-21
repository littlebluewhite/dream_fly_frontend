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
export { LEVEL_TONE } from '$lib/domain/course-level';
// 活 facade:StatusBadge.svelte 經本檔取得 LEVEL_TONE(來源=$lib/domain/course-level,批次 1 W2a)
import type { MemberAccountStatus } from '$lib/domain/members';
export { MEMBER_STATUS, MEMBER_ACCOUNT_STATUS } from '$lib/domain/members';
export type { MemberStatus, MemberAccountStatus } from '$lib/domain/members';
// 活 facade:StatusBadge.svelte/admin/api.ts/member-account-filter.ts 等經本檔取得 MEMBER_STATUS/MEMBER_ACCOUNT_STATUS/MemberStatus/MemberAccountStatus(來源=$lib/domain/members,批次 1 W2a)
import type { VenueStatus } from '$lib/domain/venues';
export { VENUE_STATUS } from '$lib/domain/venues';
export type { VenueStatus } from '$lib/domain/venues';
// 活 facade:VenueEditDialog.svelte/StatusBadge.svelte 等經本檔取得 VENUE_STATUS/VenueStatus(來源=$lib/domain/venues,批次 1 W2a)
import type { TicketType } from '$lib/domain/tickets';
export { TICKET_TYPE } from '$lib/domain/tickets';
export type { TicketType } from '$lib/domain/tickets';
// 活 facade:TicketEditDialog.svelte/admin/api.ts/StatusBadge(.test).ts 等經本檔取得 TICKET_TYPE/TicketType(來源=$lib/domain/tickets,批次 1 W2a)
import type { ClassStatus } from '$lib/domain/classes';
export { STATUS_TONE } from '$lib/domain/classes';
export type { ClassStatus } from '$lib/domain/classes';
// 活 facade:StatusBadge.svelte/admin/api.ts 等經本檔取得 STATUS_TONE/ClassStatus(來源=$lib/domain/classes,批次 1 W2a)

export type PayStatus = 'paid' | 'due' | 'trial';
export type AttMark = 'p' | 'a' | 'l' | 'v';
export type TodayState = 'done' | 'prep' | 'live' | 'soon' | 'wait';

/* ───────────────────────── single-source domain seed ─────────────────────────
 * The seed (coaches/classes/members/orders + venues/tickets/activity + reports)
 * lives in `$lib/domain`. Admin re-exports the pass-through datasets and imports
 * the base arrays + helpers that its `.map` enrichments (below) build on, so there
 * is exactly one copy of every value. Admin's public API is unchanged. */

// Pure pass-throughs (no local use) — re-export domain's value + type verbatim.
// ADR 0010 §4 漂移註記:值轉出當時「仍是活值」,coaches 頁接真後端後值消費者萎縮至僅
// 測試,依同 ADR §1 重驗、§2 值/型別分家退役——值定義刪除,型別轉出續留。
export type { Coach } from '$lib/domain/coaches';

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
// ADR 0010 §4 漂移註記:值轉出當時「仍是活值」,venues 頁接真後端後值消費者萎縮至僅
// 測試,依同 ADR §1 重驗、§2 值/型別分家退役——值定義刪除,型別轉出續留。
export type { Venue } from '$lib/domain/venues';
// ADR 0010 §4 漂移註記:值轉出當時「仍是活值」,tickets 頁接真後端後值消費者萎縮至僅
// 測試,依同 ADR §1 重驗、§2 值/型別分家退役——值定義刪除,型別轉出續留。
export type { Ticket } from '$lib/domain/tickets';
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
import { initialOf, isoDate } from '$lib/api/wire';
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
		joined: isoDate(u.created_at),
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
// MEMBER_STATUS/MEMBER_ACCOUNT_STATUS/VENUE_STATUS/TICKET_TYPE/STATUS_TONE/LEVEL_TONE
// 六張表已隨批次 1 W2a 單源收斂移至 $lib/domain（見檔頭 unions 區塊的 re-export），
// 本檔不再本地宣告，只留下面兩張沒有搬遷的表。
export const PAY_STATUS: Record<PayStatus, [Tone, string]> = {
	paid: ['success', '已繳清'],
	due: ['warning', '待續費'],
	trial: ['info', '體驗中']
};
export { ORDER_STATUS } from '$lib/api/wire';
/** ⚠ raw hex colour + label (NOT a Tone) — used for the 6-dot attendance strip. */
export const ATT_MARK: Record<AttMark, [string, string]> = {
	p: ['#10B981', '出'],
	a: ['#EF4444', '缺'],
	l: ['#F59E0B', '遲'],
	v: ['#94A3B8', '假']
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
 * `Activity`/`Coach`/`Venue`/`Ticket` 皆為 type-only re-export(值定義已全數退役——
 * Activity 見 Task F11 note above,Coach/Venue/Ticket 見各自 export type 行旁的
 * ADR 0010 §4 漂移註記)。 */

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
