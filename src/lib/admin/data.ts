/* Dream Fly — 管理後台 · shared data, types + derivations
 * Ported from the admin handoff source (docs/design/admin/data.jsx). The React
 * source enriches base arrays by mutation (forEach); here we translate that to
 * immutable `.map((x,i) => ({...x, derived}))` so the exported arrays are fully
 * materialised and strictly typed (a missing derivation is a compile error). */

/* ───────────────────────── unions ───────────────────────── */
export type Tone =
	| 'primary'
	| 'accent'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'neutral';

export type MemberStatus = 'active' | 'warning' | 'paused';
export type PayStatus = 'paid' | 'due' | 'trial';
export type OrderStatus = 'paid' | 'pending' | 'refunded';
export type AttMark = 'p' | 'a' | 'l' | 'v';
export type TicketType = 'pass' | 'trial' | 'event';
export type VenueStatus = 'available' | 'maintenance';
export type Level = '啟蒙' | '入門' | '基礎' | '進階' | '選手';
export type ClassStatus = '招生中' | '候補' | '額滿';
export type CoachStatus = 'online' | 'busy' | 'offline';
export type TodayState = 'done' | 'prep' | 'live' | 'soon' | 'wait';

/* ───────────────────────── single-source domain seed ─────────────────────────
 * The seed (coaches/classes/members/orders + venues/tickets/activity + reports)
 * lives in `$lib/domain`. Admin re-exports the pass-through datasets and imports
 * the base arrays + helpers that its `.map` enrichments (below) build on, so there
 * is exactly one copy of every value. Admin's public API is unchanged. */

// Pure pass-throughs (no local use) — re-export domain's value + type verbatim.
export { COACHES, type Coach } from '$lib/domain/coaches';
export { VENUES, type Venue } from '$lib/domain/venues';
export { TICKETS, type Ticket } from '$lib/domain/tickets';
export { ACTIVITY, type Activity } from '$lib/domain/activity';
export {
	CATEGORY_SPLIT,
	TOP_COURSES,
	VENUE_USAGE,
	ATT_DIST,
	RETENTION,
	AGE_DIST,
	CAMPUS_REVENUE,
	PAYMENT_SPLIT,
	FUNNEL,
	WEEKDAY_LOAD,
	TIER_DIST,
	INCOME_SOURCES,
	COACH_PERF,
	// Row types were part of admin's public API on `main` — re-export them too (not just values).
	type PctSlice,
	type TopCourse,
	type VenueUsage,
	type CountBar,
	type RetentionBar,
	type CampusRevenue,
	type FunnelStage,
	type WeekdayLoad,
	type IncomeSource,
	type CoachPerf
} from '$lib/domain/reports';

// Base arrays consumed by the `.map` derivations that STAY in admin (import, not re-export).
import { CLASSES_BASE, type ClassBase } from '$lib/domain/classes';
import { MEMBERS_BASE, type MemberBase } from '$lib/domain/members';
import { ORDERS_BASE, type OrderBase } from '$lib/domain/orders';
import { CAMPUSES, ENROLL_SOURCES, tierOf } from '$lib/domain/shared';
// `tierOf` is a local binding (used in the MEMBERS derivation) AND part of admin's public API.
export { tierOf };

/* ───────────────────────── classes ───────────────────────── */
export interface ClassRow extends ClassBase {
	startDate: string;
	checkinRate: number;
	makeup: number;
}

export const CLASSES: ClassRow[] = CLASSES_BASE.map((k, i) => ({
	...k,
	startDate: '2026/03/' + String((i % 27) + 1).padStart(2, '0'),
	checkinRate: 86 + (i % 12),
	makeup: i % 3
}));

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

export const MEMBERS: Member[] = MEMBERS_BASE.map((m, i) => {
	const [tier, tierColor] = tierOf(m.points);
	const by = 2026 - m.age;
	const birthday =
		by + '/' + String(((i * 5) % 12) + 1).padStart(2, '0') + '/' + String(((i * 7) % 27) + 1).padStart(2, '0');
	const renewDue =
		m.pay === 'trial'
			? '體驗 06/30 到期'
			: m.pay === 'due'
				? '已逾期 · ' + ['05/28', '06/01', '06/03', '06/05'][i % 4]
				: '2026/' + ['09', '10', '11', '12'][i % 4] + '/15';
	return {
		...m,
		campus: CAMPUSES[i % CAMPUSES.length],
		source: ENROLL_SOURCES[(i * 2 + 1) % ENROLL_SOURCES.length],
		birthday,
		tier,
		tierColor,
		renewDue,
		lineId: '@df' + m.id.slice(-4)
	};
});

/* ───────────────────────── orders ───────────────────────── */
export interface Order extends OrderBase {
	campus: string;
	tax: number;
	net: number;
	paidAt: string;
	taxId: string;
}

export const ORDERS: Order[] = ORDERS_BASE.map((o, i) => {
	const tax = Math.round(o.amount - o.amount / 1.05);
	return {
		...o,
		campus: CAMPUSES[i % CAMPUSES.length],
		tax,
		net: o.amount - tax,
		paidAt: o.status === 'paid' ? o.date : o.status === 'pending' ? '—（待付款）' : o.date,
		taxId: i % 5 === 0 ? '539012' + String(40 + i).slice(0, 2) : '—'
	};
});

/* ───────────────────────── status maps (shapes differ!) ───────────────────────── */
/** [Tone, label] tuples. */
export const MEMBER_STATUS: Record<MemberStatus, [Tone, string]> = {
	active: ['success', '在學中'],
	warning: ['warning', '出席偏低'],
	paused: ['neutral', '暫停中']
};
export const PAY_STATUS: Record<PayStatus, [Tone, string]> = {
	paid: ['success', '已繳清'],
	due: ['warning', '待續費'],
	trial: ['info', '體驗中']
};
export const ORDER_STATUS: Record<OrderStatus, [Tone, string]> = {
	paid: ['success', '已付款'],
	pending: ['warning', '待付款'],
	refunded: ['neutral', '已退款']
};
export const VENUE_STATUS: Record<VenueStatus, [Tone, string]> = {
	available: ['success', '可預約'],
	maintenance: ['warning', '維護中']
};
export const TICKET_TYPE: Record<TicketType, [Tone, string]> = {
	pass: ['primary', '通行票'],
	trial: ['success', '體驗票'],
	event: ['accent', '活動票']
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
export const LEVELS: Level[] = ['啟蒙', '入門', '基礎', '進階', '選手'];
export const CATS: string[] = ['競技體操', '競技啦啦隊', '兒童基礎', '幼兒體操', '成人體操', '跑酷'];
export const CLASS_STATUS: ClassStatus[] = ['招生中', '候補', '額滿'];
/** Ticket type union as a 新增/編輯票券 Select source (keys of TICKET_TYPE). */
export const TICKET_TYPES: TicketType[] = ['pass', 'trial', 'event'];
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
export const TODAY: TodayClass[] = [
	{ time: '10:00', name: '幼兒體操 啟蒙班', coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'done', tone: 'neutral', label: '已結束' },
	{ time: '16:00', name: '親子體操 同樂班', coach: '黃詩涵', room: 'C 軟墊區', count: 5, state: 'prep', tone: 'info', label: '備課中' },
	{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, state: 'live', tone: 'success', label: '進行中' },
	{ time: '19:00', name: '競技啦啦隊 進階班', coach: '林雅婷', room: 'A 訓練館', count: 11, state: 'soon', tone: 'warning', label: '即將開始' },
	{ time: '20:00', name: '成人體操 基礎班', coach: '王思齊', room: 'A 訓練館', count: 9, state: 'wait', tone: 'neutral', label: '尚未開始' }
];

/* ───────────────────────── activity / venues / tickets ─────────────────────────
 * `COACHES`, `ACTIVITY`, `VENUES`, `TICKETS` are re-exported from `$lib/domain` at the top. */

/* ═════════════════════════ 報表分析 datasets ═════════════════════════ */
export interface ReportKpi {
	icon: string;
	label: string;
	value: string;
	delta: string;
	tint: string;
	color: string;
}
export const REPORT_KPIS: ReportKpi[] = [
	{ icon: 'dollar-sign', label: '本月營收', value: 'NT$ 458,200', delta: '+12.5%', tint: '#0066CC14', color: 'var(--df-primary)' },
	{ icon: 'book-open', label: '課程報名', value: '142 筆', delta: '+8.3%', tint: '#10B98114', color: '#10B981' },
	{ icon: 'user-plus', label: '新增會員', value: '86 位', delta: '+24.8%', tint: '#F59E0B14', color: '#F59E0B' },
	{ icon: 'ticket', label: '票券銷售', value: '234 張', delta: '+18.7%', tint: '#8B5CF614', color: '#8B5CF6' },
	{ icon: 'repeat', label: '會員留存率', value: '88.4%', delta: '+3.1%', tint: '#0EA5E914', color: '#0EA5E9' },
	{ icon: 'calendar-check', label: '平均出席率', value: '91.2%', delta: '+1.4%', tint: '#10B98114', color: '#10B981' }
];

export interface RevenueRow {
	name: string;
	meta: string;
	amount: string;
	drill: string;
	dot: string;
}
export const REVENUE_BREAKDOWN: RevenueRow[] = [
	{ name: '課程報名訂單', meta: '142 筆 · 平均客單 NT$ 2,197', amount: 'NT$ 312,000', drill: '下鑽班級／訂單', dot: 'var(--df-primary)' },
	{ name: '票券銷售', meta: '234 張 · 月票 / 體驗券 / 比賽票', amount: 'NT$ 98,400', drill: '下鑽票券來源', dot: '#8B5CF6' },
	{ name: '裝備與週邊', meta: '86 筆 · 護具 / 隊服', amount: 'NT$ 47,800', drill: '下鑽訂單', dot: 'var(--df-warning)' }
];
export const REVENUE_TOTAL = 'NT$ 458,200';

export interface TrendBar {
	m: string;
	h: number;
	peak?: boolean;
}
export const REVENUE_TREND: TrendBar[] = [
	{ m: '1月', h: 102 }, { m: '2月', h: 112 }, { m: '3月', h: 107 }, { m: '4月', h: 121 },
	{ m: '5月', h: 128 }, { m: '6月', h: 138 }, { m: '7月', h: 133 }, { m: '8月', h: 144 },
	{ m: '9月', h: 151 }, { m: '10月', h: 160, peak: true }, { m: '11月', h: 148 }, { m: '12月', h: 156 }
];

/* The other report datasets are re-exported from `$lib/domain/reports` at the top of this
 * file: CATEGORY_SPLIT, TOP_COURSES, VENUE_USAGE, ATT_DIST, RETENTION, AGE_DIST,
 * CAMPUS_REVENUE, PAYMENT_SPLIT, FUNNEL, WEEKDAY_LOAD, TIER_DIST, INCOME_SOURCES, COACH_PERF.
 * Kept local above (values still diverge from mobile by more than NT$ spacing): REPORT_KPIS,
 * REVENUE_BREAKDOWN, REVENUE_TOTAL, REVENUE_TREND. */
