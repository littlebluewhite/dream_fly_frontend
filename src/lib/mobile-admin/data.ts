/* Dream Fly — 行動版後台 · mock data + helpers (ported from mobile-admin/data.jsx).
 *
 * Mock-only, no backend. Faithful to the prototype, including the module-load
 * augmentation the prototype did via `forEach` (campus / tier / tax / startDate …)
 * — replicated here as deterministic, index-derived `.map` builders so the output
 * is identical and SSR-safe (no Date.now / Math.random at module scope). */

export type Tone = [string, string];

export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');
export const fmtK = (n: number): string =>
	n >= 1000 ? 'NT$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' : 'NT$' + n;

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
	COACH_PERF
} from '$lib/domain/reports';
// `Split` was mobile's name for the percentage-split row type on `main` — preserve it as an alias.
export type { PctSlice as Split } from '$lib/domain/reports';

// Base arrays consumed by the `.map` derivations that STAY in mobile (import, not re-export).
import { CLASSES_BASE } from '$lib/domain/classes';
import { MEMBERS_BASE } from '$lib/domain/members';
import { ORDERS_BASE } from '$lib/domain/orders';
import { tierOf, CAMPUSES, ENROLL_SOURCES } from '$lib/domain/shared';
// Local bindings used by the MEMBERS derivation AND part of mobile's public API
// (imported from `$lib/mobile-admin/data` by overlays/MemberForm.svelte).
export { tierOf, CAMPUSES, ENROLL_SOURCES };

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
export interface ClassRow {
	id: string;
	name: string;
	level: string;
	cat: string;
	coach: string;
	room: string;
	day: string;
	time: string;
	enrolled: number;
	cap: number;
	age: string;
	price: number;
	status: string;
	wait: number;
	term: string;
	sessions: number;
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

/* ---- Members / 學員 ----
   pay: paid 已繳清 / due 待續費 / trial 體驗中 · remain 剩餘堂數 · recent 近六堂 p出席 a缺席 l遲到 v請假 */
export interface MemberRow {
	id: string;
	name: string;
	initial: string;
	color: string;
	course: string;
	coach: string;
	att: number;
	status: 'active' | 'warning' | 'paused';
	age: number;
	parent: string;
	phone: string;
	joined: string;
	points: number;
	pay: 'paid' | 'due' | 'trial';
	remain: number;
	lastSeen: string;
	recent: string[];
	emName: string;
	emPhone: string;
	campus: string;
	source: string;
	birthday: string;
	tier: string;
	tierColor: string;
	renewDue: string;
	lineId: string;
}
export const MEMBERS: MemberRow[] = MEMBERS_BASE.map((m, i) => {
	const by = 2026 - m.age;
	const [tier, tierColor] = tierOf(m.points);
	const renewDue = m.pay === 'trial' ? '體驗 06/30 到期' : m.pay === 'due' ? '已逾期 · ' + ['05/28', '06/01', '06/03', '06/05'][i % 4] : '2026/' + ['09', '10', '11', '12'][i % 4] + '/15';
	return {
		...(m as Omit<MemberRow, 'campus' | 'source' | 'birthday' | 'tier' | 'tierColor' | 'renewDue' | 'lineId'>),
		campus: CAMPUSES[i % CAMPUSES.length],
		source: ENROLL_SOURCES[(i * 2 + 1) % ENROLL_SOURCES.length],
		birthday: by + '/' + String((i * 5) % 12 + 1).padStart(2, '0') + '/' + String((i * 7) % 27 + 1).padStart(2, '0'),
		tier,
		tierColor,
		renewDue,
		lineId: '@df' + m.id.slice(-4)
	};
});

export const PAY_STATUS: Record<string, Tone> = { paid: ['success', '已繳清'], due: ['warning', '待續費'], trial: ['info', '體驗中'] };
export const ATT_MARK: Record<string, [string, string]> = { p: ['#10B981', '出'], a: ['#EF4444', '缺'], l: ['#F59E0B', '遲'], v: ['#94A3B8', '假'] };

/* ---- Orders / 訂單 ---- */
export interface OrderRow {
	id: string;
	member: string;
	initial: string;
	color: string;
	item: string;
	amount: number;
	status: 'paid' | 'pending' | 'refunded';
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
}
export const ORDERS: OrderRow[] = ORDERS_BASE.map((o, i) => ({
	...(o as Omit<OrderRow, 'campus' | 'tax' | 'net' | 'paidAt' | 'taxId'>),
	campus: CAMPUSES[i % CAMPUSES.length],
	tax: Math.round(o.amount - o.amount / 1.05),
	net: o.amount - Math.round(o.amount - o.amount / 1.05),
	paidAt: o.status === 'paid' ? o.date : o.status === 'pending' ? '—（待付款）' : o.date,
	taxId: i % 5 === 0 ? '539012' + String(40 + i).slice(0, 2) : '—'
}));

export const ORDER_STATUS: Record<string, Tone> = { paid: ['success', '已付款'], pending: ['warning', '待付款'], refunded: ['neutral', '已退款'] };

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
export const TODAY: TodayRow[] = [
	{ time: '10:00', name: '幼兒體操 啟蒙班', coach: '黃詩涵', room: 'C 軟墊區', count: 6, tone: 'neutral', label: '已結束' },
	{ time: '16:00', name: '親子體操 同樂班', coach: '黃詩涵', room: 'C 軟墊區', count: 5, tone: 'info', label: '備課中' },
	{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, tone: 'success', label: '進行中' },
	{ time: '19:00', name: '競技啦啦隊 進階班', coach: '林雅婷', room: 'A 訓練館', count: 11, tone: 'warning', label: '即將開始' },
	{ time: '20:00', name: '成人體操 基礎班', coach: '王思齊', room: 'A 訓練館', count: 9, tone: 'neutral', label: '尚未開始' }
];
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
// `ACTIVITY` + `type Activity` are re-exported from `$lib/domain/activity` (top of
// file). Keep the original `ActivityRow` name as an alias for the public API.
import type { Activity as ActivityRowType } from '$lib/domain/activity';
export type ActivityRow = ActivityRowType;

/* ---- Notifications (mobile bell) ---- */
export interface AdminNotif {
	icon: string;
	tone: string;
	bg: string;
	title: string;
	body: string;
	time: string;
	unread: boolean;
}
export const ADMIN_NOTIFS: AdminNotif[] = [
	{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '新會員報名', body: '謝佩珊 完成報名兒童基礎 B 班', time: '12 分鐘前', unread: true },
	{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', title: '收款成功', body: '訂單 DF-24061 已付款 NT$4,800', time: '38 分鐘前', unread: true },
	{ icon: 'user-x', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '出席偏低警示', body: '張宇辰 出席率降至 76%，建議聯繫家長', time: '1 小時前', unread: true },
	{ icon: 'rotate-ccw', tone: 'var(--df-text-light)', bg: 'var(--df-bg-light)', title: '訂單退款', body: '訂單 DF-24057 已退款 NT$600', time: '3 小時前', unread: false }
];
export const COACH_NOTIFS: AdminNotif[] = [
	{ icon: 'calendar-check', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '點名提醒', body: '19:00 競技啦啦隊 進階班 尚未完成點名', time: '5 分鐘前', unread: true },
	{ icon: 'message-circle', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '王先生（承恩家長）', body: '教練您好，承恩這週四想多留半小時…', time: '10 分鐘前', unread: true },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', title: '評核待更新', body: '選手班 3 位學員技能評量待更新', time: '昨天 16:05', unread: false }
];

export const MEMBER_STATUS: Record<string, Tone> = { active: ['success', '在學中'], warning: ['warning', '出席偏低'], paused: ['neutral', '暫停中'] };
export const LEVEL_TONE: Record<string, string> = { 啟蒙: 'info', 入門: 'info', 基礎: 'primary', 進階: 'warning', 選手: 'accent' };
export const STATUS_TONE: Record<string, string> = { 招生中: 'success', 候補: 'warning', 額滿: 'neutral' };

/* ---- Skill assessments (keyed by member id) ---- */
export const SKILLS: Record<string, Skill[]> = {
	GY2024001: [['前滾翻', 95], ['後手翻', 88], ['側翻', 92]],
	GY2024006: [['前滾翻', 90], ['後手翻', 84], ['倒立', 78]],
	GY2024010: [['前滾翻', 97], ['後手翻', 91], ['側翻', 95]],
	GY2024007: [['前滾翻', 82], ['後手翻', 70], ['倒立', 65]]
};
export type Skill = [string, number];

/* ===== 報表分析 data ===== */
export interface Kpi {
	icon: string;
	label: string;
	value: string;
	delta: string;
	up: boolean;
	tint: string;
	color: string;
}
export const REPORT_KPIS: Kpi[] = [
	{ icon: 'dollar-sign', label: '本月營收', value: 'NT$458K', delta: '+12.5%', up: true, tint: 'var(--df-primary-bg)', color: 'var(--df-primary)' },
	{ icon: 'book-open', label: '課程報名', value: '142', delta: '+8.3%', up: true, tint: 'var(--df-success-bg)', color: '#10B981' },
	{ icon: 'user-plus', label: '新增會員', value: '86', delta: '+24.8%', up: true, tint: '#FFF3D6', color: '#F59E0B' },
	{ icon: 'ticket', label: '票券銷售', value: '234', delta: '+18.7%', up: true, tint: '#F3EEFE', color: '#8B5CF6' },
	{ icon: 'repeat', label: '會員留存率', value: '88.4%', delta: '+3.1%', up: true, tint: '#E0F2FE', color: '#0EA5E9' },
	{ icon: 'calendar-check', label: '平均出席率', value: '91.2%', delta: '+1.4%', up: true, tint: 'var(--df-success-bg)', color: '#10B981' }
];
export const REVENUE_TREND: { m: string; h: number; peak?: boolean }[] = [
	{ m: '1', h: 102 }, { m: '2', h: 112 }, { m: '3', h: 107 }, { m: '4', h: 121 },
	{ m: '5', h: 128 }, { m: '6', h: 138 }, { m: '7', h: 133 }, { m: '8', h: 144 },
	{ m: '9', h: 151 }, { m: '10', h: 160, peak: true }, { m: '11', h: 148 }, { m: '12', h: 156 }
];

/* revenue-source drill-down */
export const REVENUE_TOTAL = 'NT$458,200';
export const REVENUE_BREAKDOWN: { name: string; meta: string; amount: string; drill: string; dot: string }[] = [
	{ name: '課程報名訂單', meta: '142 筆 · 平均客單 NT$2,197', amount: 'NT$312,000', drill: '班級／訂單', dot: 'var(--df-primary)' },
	{ name: '票券銷售', meta: '234 張 · 月票 / 體驗券 / 比賽票', amount: 'NT$98,400', drill: '票券來源', dot: '#8B5CF6' },
	{ name: '裝備與週邊', meta: '86 筆 · 護具 / 隊服', amount: 'NT$47,800', drill: '訂單明細', dot: 'var(--df-warning)' }
];

/* ===== 場館管理 data ===== */
// `Venue` + `VENUES` are re-exported from `$lib/domain/venues` (top of file).
export const VENUE_STATUS: Record<string, Tone> = { available: ['success', '可使用'], maintenance: ['warning', '維護中'] };

/* ===== 票券管理 data ===== */
// `Ticket` + `TICKETS` are re-exported from `$lib/domain/tickets` (top of file).
export const TICKET_TYPE: Record<string, Tone> = { pass: ['primary', '通行票'], trial: ['success', '體驗票'], event: ['accent', '活動票'] };
