/* Dream Fly — 報表分析 seed (single source of truth)
 * Data and types copied verbatim from src/lib/admin/data.ts.
 * Excludes the report symbols whose values diverge between admin and mobile
 * (kept per-surface, NOT single-sourced): REPORT_KPIS/ReportKpi,
 * REVENUE_TREND/TrendBar, REVENUE_BREAKDOWN/RevenueRow, REVENUE_TOTAL,
 * INCOME_SOURCES/IncomeSource, COACH_PERF/CoachPerf (NT$ spacing / label format
 * diverges). (TODAY is a schedule, not a report — it was never part of this module.) */

/** label + pct + colour — shared by the category / age / payment splits. */
export interface PctSlice {
	label: string;
	pct: number;
	color: string;
}

export const CATEGORY_SPLIT: PctSlice[] = [
	{ label: '競技體操', pct: 35, color: 'var(--df-primary)' },
	{ label: '幼兒體操', pct: 28, color: '#10B981' },
	{ label: '韻律體操', pct: 20, color: 'var(--df-warning)' },
	{ label: '彈翻床', pct: 17, color: '#8B5CF6' }
];

export interface TopCourse {
	rank: number;
	name: string;
	count: number;
}

export const TOP_COURSES: TopCourse[] = [
	{ rank: 1, name: '兒童體操初階班', count: 96 },
	{ rank: 2, name: '競技體操選手班', count: 78 },
	{ rank: 3, name: '幼兒體操啟蒙班', count: 64 },
	{ rank: 4, name: '成人體適能班', count: 52 },
	{ rank: 5, name: '韻律體操進階班', count: 41 }
];

export interface VenueUsage {
	name: string;
	pct: number;
	hours: string;
	color: string;
}

export const VENUE_USAGE: VenueUsage[] = [
	{ name: 'A 訓練館', pct: 86, hours: '148 小時', color: 'var(--df-primary)' },
	{ name: 'B 教室', pct: 72, hours: '124 小時', color: '#0EA5E9' },
	{ name: 'C 軟墊區', pct: 64, hours: '110 小時', color: '#10B981' },
	{ name: 'E 多功能教室', pct: 55, hours: '92 小時', color: '#8B5CF6' },
	{ name: 'F 體能訓練室', pct: 41, hours: '68 小時', color: '#EC4899' },
	{ name: '戶外場', pct: 38, hours: '62 小時', color: 'var(--df-warning)' }
];

/** label + count + colour — shared by attendance / tier distributions. */
export interface CountBar {
	label: string;
	count: number;
	color: string;
}

export const ATT_DIST: CountBar[] = [
	{ label: '95–100%', count: 11, color: 'var(--df-success)' },
	{ label: '85–94%', count: 10, color: 'var(--df-primary)' },
	{ label: '75–84%', count: 5, color: '#0EA5E9' },
	{ label: '低於 75%', count: 6, color: 'var(--df-warning)' }
];

export interface RetentionBar {
	m: string;
	nu: number;
	re: number;
}

export const RETENTION: RetentionBar[] = [
	{ m: '1月', nu: 14, re: 38 }, { m: '2月', nu: 18, re: 41 }, { m: '3月', nu: 22, re: 44 },
	{ m: '4月', nu: 16, re: 47 }, { m: '5月', nu: 20, re: 49 }, { m: '6月', nu: 24, re: 52 }
];

export const AGE_DIST: PctSlice[] = [
	{ label: '3–5 歲', pct: 22, color: '#10B981' },
	{ label: '6–9 歲', pct: 34, color: 'var(--df-primary)' },
	{ label: '10–13 歲', pct: 28, color: '#0EA5E9' },
	{ label: '14 歲以上', pct: 16, color: '#8B5CF6' }
];

export interface CampusRevenue {
	name: string;
	amount: string;
	pct: number;
	students: number;
	color: string;
}

export const CAMPUS_REVENUE: CampusRevenue[] = [
	{ name: '美村本館', amount: 'NT$268K', pct: 100, students: 142, color: 'var(--df-primary)' },
	{ name: '文心分館', amount: 'NT$121K', pct: 45, students: 68, color: '#0EA5E9' },
	{ name: '北屯分館', amount: 'NT$69K', pct: 26, students: 38, color: '#10B981' }
];

export const PAYMENT_SPLIT: PctSlice[] = [
	{ label: '信用卡', pct: 46, color: 'var(--df-primary)' },
	{ label: 'LINE Pay', pct: 24, color: '#10B981' },
	{ label: 'ATM 轉帳', pct: 16, color: '#0EA5E9' },
	{ label: '街口支付', pct: 9, color: '#8B5CF6' },
	{ label: '現金', pct: 5, color: 'var(--df-warning)' }
];

export interface FunnelStage {
	label: string;
	count: number;
	pct: number;
	color: string;
}

export const FUNNEL: FunnelStage[] = [
	{ label: '預約體驗', count: 318, pct: 100, color: 'var(--df-primary)' },
	{ label: '完成體驗', count: 246, pct: 77, color: '#0EA5E9' },
	{ label: '正式報名', count: 142, pct: 45, color: '#10B981' },
	{ label: '季末續報', count: 112, pct: 35, color: 'var(--df-accent-dark)' }
];

export interface WeekdayLoad {
	d: string;
	classes: number;
	rate: number;
}

export const WEEKDAY_LOAD: WeekdayLoad[] = [
	{ d: '一', classes: 8, rate: 92 }, { d: '二', classes: 11, rate: 95 }, { d: '三', classes: 9, rate: 90 },
	{ d: '四', classes: 12, rate: 94 }, { d: '五', classes: 10, rate: 88 }, { d: '六', classes: 14, rate: 96 }, { d: '日', classes: 9, rate: 85 }
];

export const TIER_DIST: CountBar[] = [
	{ label: '金卡', count: 9, color: '#F59E0B' },
	{ label: '銀卡', count: 13, color: '#94A3B8' },
	{ label: '銅卡', count: 16, color: '#B45309' },
	{ label: '一般', count: 10, color: '#64748B' }
];
