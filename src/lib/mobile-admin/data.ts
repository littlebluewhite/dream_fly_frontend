/* Dream Fly — 行動版後台 · mock data + helpers (ported from mobile-admin/data.jsx).
 *
 * Mock-only, no backend. Faithful to the prototype, including the module-load
 * augmentation the prototype did via `forEach` (campus / tier / tax / startDate …)
 * — replicated here as deterministic, index-derived `.map` builders so the output
 * is identical and SSR-safe (no Date.now / Math.random at module scope). */

export type Tone = [string, string];

/* ---- single-source domain seed ----
 * The ops-pair shared seed (coaches / classes / members / orders + venues /
 * tickets / activity + reports) lives in `$lib/domain`. Mobile imports the
 * base arrays + helpers its own `.map` projections (below) build on, so
 * there is exactly one copy of every value. Mobile's own flat types, casts,
 * tuple `Tone`, status maps and mobile-only data stay local; its public API
 * is unchanged. */

// 對 `$lib/domain` 的純轉手 re-export 已全數退役(C4 批3);本節其下唯一還在轉手的
// 是來源為 coach surface 的邊界 seam(Student,見卡 3 段落與 ADR 0014 §1)。
// C4 批3(facade 純轉手退役):COACHES(值，test-only 消費 + stores.ts/stores.test.ts
// 內部種子值)/type Coach 退役——消費端改直取 $lib/domain/coaches。VENUES/TICKETS
// 值早於本批已退役(見 api.ts getVenues/getTickets 薄委派 re-export；唯一消費者
// VenuesScreen/TicketsScreen 改吃 payload)；本批複核 Venue/Ticket 型別轉出本身也是
// 零附加型別事實的純轉手，一併退役，消費端(含 api.ts)改直取 $lib/domain/venues、
// $lib/domain/tickets。domain/venues.ts、domain/tickets.ts 的 VENUES/TICKETS seed
// 本身不動(admin 頁測試的 canonical fixture)。
// Task P4-F3：報表分析(ReportsScreen.svelte)改接真 GET /reports/admin(復用桌面
// `$lib/admin/api` 的 getReports(),ReportsScreen 直接 import,非經本檔或
// mobile-admin/api 轉手)——domain/reports.ts 的
// 13 個 mock 圖表陣列/型別(CATEGORY_SPLIT/TOP_COURSES/…/COACH_PERF，含 `Split` 別名)
// 已無任何消費者，domain/reports.ts 本身隨此任務一併 `git rm`。
// 批次 1 W2a：MemberAccountStatus 本地 union 改由 domain 轉出;C4 批3 複核零外部
// 消費者(StatusBadgeM.svelte 改直取 $lib/domain/members),退役對外 export——
// `export type {…} from` 不引入本地作用域,本檔下面的 MEMBER_ACCOUNT_STATUS(Record
// 鍵型別)仍要用到這個型別,改由下面 base-array import 區塊的 import type 供本檔內部使用。
// 卡 3：Student 型別經本 seam 轉手(R16 Task 2a:LEVEL_TINT 查表隨後端沒有的
// Student.level 退役，不再轉手)——單一複本留在
// $lib/coach/data（單複本無分歧，搬 domain 只是搬家，ADR 0013 case-甲 同款否決），
// mobile-admin 的學員頁/StudentActionSheet 一律經這裡取用，不再直取 coach surface
// （api.ts 是 seam 本體，其對 coach/data 的型別 import 不在此列）。
export type { Student } from '$lib/coach/data';

// R15(候選 F-3，誠實開機)：CLASSES/MEMBERS/ORDERS 三個 .map 衍生 builder 已退役——
// members/classes/orders store 改為誠實開機(`[]`)，值改由真 GET /courses、/users、
// /orders 水合(見 mobile-admin/stores.ts opsGate)。下方 Tone 查表(STATUS_TONE 等)
// 與已退役的班級/學員/訂單種子陣列無關，不受影響。
import { STATUS_TONE as STATUS_TONE_BASE } from '$lib/domain/classes';
import { MEMBER_ACCOUNT_STATUS as MEMBER_ACCOUNT_STATUS_BASE, type MemberAccountStatus } from '$lib/domain/members';
import { VENUE_STATUS as VENUE_STATUS_BASE } from '$lib/domain/venues';
import { TICKET_TYPE as TICKET_TYPE_BASE } from '$lib/domain/tickets';
import { LEVEL_TONE as LEVEL_TONE_BASE } from '$lib/domain/course-level';
import type { IconName } from '$lib/icon-registry';
import type { TodayState } from '$lib/admin/data';

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

// R15(候選 列型別單源)：ClassRow/MemberRow/OrderRow 三個型別本體(逐欄同桌面
// admin/data.ts 的 ClassRow/MemberAccount/Order)已退役——單一來源改為
// admin/data.ts，消費端改 `import type { ClassRow, MemberAccount as MemberRow,
// Order as OrderRow } from '$lib/admin/data'`(ADR-0019 C4：alias 留在 import
// 端，不另設 re-export)。

/* ---- Today schedule (admin = all studio) ---- */
export interface TodayRow {
	time: string;
	name: string;
	coach?: string;
	room: string;
	count: number;
	/** 場次狀態(C5)——admin 首頁「進行中課堂」橫幅據此判斷，不再比對 label 字面。型別
	 *  借桌面 admin/data.ts 的 TodayState(5 值超集，含歷史緩衝態 'prep')：coach 分支
	 *  的 TodayStatus(4 值)是其子集，兩個消費端都能直接賦值，不需要窄化 cast。 */
	state: TodayState;
	tone: string;
	label: string;
	taken?: boolean;
}
// Task P4-F3：TODAY mock 退役(F11 已把 mobile-admin getAdminHome() 的今日課表改讀真
// GET /sessions/today admin 分支——見 $lib/mobile-admin/api getAdminHome()，唯一消費者
// 早已改吃 payload，此常數自 F11 起無 production 引用)。C4：COACH_TODAY 示範陣列同步
// 退役——getCoachHome() 自 Task 19 起改讀真 getDashboard() 的今日課表，grep 實證零
// production 消費者(page.test.ts 用自帶 inline fixture)。TodayRow 型別維持不動——
// api.ts 的 mapTodayClassToRow()/mapAdminTodayRow() 仍以它為回傳型別(:136-139,233-235)，
// coach/page.test.ts 亦以它標註 inline fixture。

// R10(雙生收斂，ADR 0014 §2)：Attendance roster 種子 RosterEntry(型別)/ROSTER(值)
// 已退役——課堂點名頁(routes/mobile-admin/coach/attendance)改接
// $lib/coach/attendance-controller，與桌面 coach/attendance 頁共用同一套點名編排，
// 名冊改直吃桌面 AttRow 形狀(mid/def，經 $lib/mobile-admin/api 零映射轉出)，不再需要
// 這層行動版專屬(mid 兼作 id、def→default)的轉譯。零 production 消費者已實證
// （page.test.ts 改用自帶 inline fixture），同本檔既有死種子退役慣例(ADR 0010)。

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
// MESSAGES(同步種子)於 R14 候選 F3 退役:messages store 誠實開機為 `[]`,值逐字搬進測試
// 專用的 $lib/testing/seed-fixtures(ADR 0010)。MessageRow 仍是 getMessages() 的映射形狀。

/* ---- Activity feed ---- */
// Task P4-F3：ACTIVITY mock 退役(F11 已把 mobile-admin getAdminHome() 的最新動態改讀
// 真 GET /reports/admin/activity——見 $lib/mobile-admin/api getAdminHome()，唯一消費者
// 早已改吃 payload，此值與其 `Activity` 型別重新匯出自 F11 起無 production 引用)。
// C4 批3：ActivityRow 型別別名(零附加型別事實的純轉手改名)退役——api.ts 改直取
// $lib/domain/activity 的 `Activity`，用 import-site alias `Activity as ActivityRow`
// 保留本檔原名。

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
// $lib/admin/api 的 getReports() payload；見 report-math.ts)。

/* ===== 場館管理 data ===== */
// `Venue` 型別已 C4 批3 退役(消費端改直取 `$lib/domain/venues`)；`VENUES` 值早於
// 本批已退役(C4)。
// 批次 1 W2a：改純註記 re-assert 自 $lib/domain/venues；canonical 標籤同步改為
// 「可預約」，取代本檔舊值「可使用」——兩者原意相同、字面各自維護導致靜默發散，
// 見 ADR 0013。
export const VENUE_STATUS: Record<string, Tone> = VENUE_STATUS_BASE;

/* ===== 票券管理 data ===== */
// `Ticket` 型別已 C4 批3 退役(消費端改直取 `$lib/domain/tickets`)；`TICKETS` 值早於
// 本批已退役(C4)。
export const TICKET_TYPE: Record<string, Tone> = TICKET_TYPE_BASE;
