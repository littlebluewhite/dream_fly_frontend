import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportsPage from './+page.svelte';
import type { ReportsData } from '$lib/admin/api';
import { getReports } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getReports: vi.fn() }));

/* 報表分析 (reports.jsx ReportsView, re-scoped Task 15, re-expanded Round 4 P4-F2):
 * a PageHead with 匯出報表, a 6-card KPI band (環比 delta 前端算,null → 「—」),
 * the 13 restored chart panels fed by GET /reports/admin 的彙總 sections, and the
 * two honest courses/coaches tables. Data arrives through the getReports() seam
 * (async), so every assertion first awaits the ready phase. */
const REPORT_SECTIONS: Omit<ReportsData, 'revenue' | 'members' | 'courses' | 'coaches'> = {
	kpis: {
		newMembers: { thisMonth: 8, lastMonth: 5 },
		newEnrolments: { thisMonth: 14, lastMonth: 10 },
		paidOrdersCount: { thisMonth: 30, lastMonth: 60 },
		attendanceRate: { thisMonth: 0.92, lastMonth: 0.8 }
	},
	revenueBreakdown: [
		{ source: 'course', grossCents: 31200000, ordersCount: 142, units: 150 },
		{ source: 'ticket', grossCents: 9840000, ordersCount: 60, units: 234 },
		{ source: 'membership', grossCents: 500000, ordersCount: 5, units: 5 },
		{ source: 'course_package', grossCents: 250000, ordersCount: 2, units: 2 },
		{ source: 'merchandise', grossCents: 4780000, ordersCount: 86, units: 90 },
		{ source: 'venue_rental', grossCents: 120000, ordersCount: 3, units: 3 }
	],
	incomeSources12m: [
		{ month: '2025-09', source: 'course', grossCents: 100000, ordersCount: 1, units: 1 },
		{ month: '2025-10', source: 'course', grossCents: 200000, ordersCount: 2, units: 2 },
		{ month: '2025-09', source: 'ticket', grossCents: 100000, ordersCount: 1, units: 1 },
		{ month: '2025-10', source: 'ticket', grossCents: 0, ordersCount: 0, units: 0 }
	],
	categorySplit: [
		{ source: 'course', grossCents: 31200000, ratio: 0.6 },
		{ source: 'ticket', grossCents: 9840000, ratio: 0.2 },
		{ source: 'membership', grossCents: 500000, ratio: 0.1 },
		{ source: 'course_package', grossCents: 250000, ratio: 0.05 },
		{ source: 'merchandise', grossCents: 4780000, ratio: 0.05 }
	],
	paymentSplit: [
		{ method: 'credit_card', count: 46 },
		{ method: 'line_pay', count: 24 }
	],
	attendanceDistribution: [
		{ bucket: 'gte_95', count: 11 },
		{ bucket: '85_94', count: 10 },
		{ bucket: '75_84', count: 5 },
		{ bucket: 'lt_75', count: 6 }
	],
	ageDistribution: [
		{ bucket: '0-6', count: 22 },
		{ bucket: '7-12', count: 34 },
		{ bucket: '13-17', count: 28 },
		{ bucket: '18-25', count: 16 },
		{ bucket: '26-40', count: 0 },
		{ bucket: '41+', count: 0 }
	],
	tierDistribution: [
		{ bucket: 'regular', count: 10 },
		{ bucket: 'bronze', count: 16 },
		{ bucket: 'silver', count: 13 },
		{ bucket: 'gold', count: 9 }
	],
	retention: [
		{ month: '2025-05', newCount: 14, returningCount: 38, rate: null },
		{ month: '2025-06', newCount: 18, returningCount: 41, rate: 0.8 },
		{ month: '2025-07', newCount: 22, returningCount: 44, rate: 0.82 },
		{ month: '2025-08', newCount: 16, returningCount: 47, rate: 0.85 },
		{ month: '2025-09', newCount: 20, returningCount: 49, rate: 0.87 },
		{ month: '2025-10', newCount: 24, returningCount: 52, rate: 0.884 }
	],
	funnel: { trialInquiries: 318, newEnrolments: 142 },
	weekdayLoad: [9, 8, 11, 9, 12, 10, 14].map((presentCount, weekday) => ({ weekday, presentCount })),
	venueUsage: [
		{ venue: 'A 訓練館', minutes: 150 },
		{ venue: 'B 教室', minutes: 60 }
	]
};

// 空庫形狀(契約空庫段落:固定桶零填/開放集合空陣列;此處 fixture 用空陣列亦須不炸)
const EMPTY_REPORT_SECTIONS: typeof REPORT_SECTIONS = {
	kpis: {
		newMembers: { thisMonth: 0, lastMonth: 0 },
		newEnrolments: { thisMonth: 0, lastMonth: 0 },
		paidOrdersCount: { thisMonth: 0, lastMonth: 0 },
		attendanceRate: { thisMonth: null, lastMonth: null }
	},
	revenueBreakdown: [],
	incomeSources12m: [],
	categorySplit: [],
	paymentSplit: [],
	attendanceDistribution: [],
	ageDistribution: [],
	tierDistribution: [],
	retention: [],
	funnel: { trialInquiries: 0, newEnrolments: 0 },
	weekdayLoad: [],
	venueUsage: []
};

const PAYLOAD: ReportsData = {
	revenue: {
		thisMonth: 458200,
		lastMonth: 400000,
		trend: [
			{ m: '2025-08', h: 300000 },
			{ m: '2025-09', h: 320000 },
			{ m: '2025-10', h: 458200 }
		]
	},
	...REPORT_SECTIONS,
	members: { total: 120, newThisMonth: 8, active: 96 },
	courses: [
		{ id: 'c1', name: '競技體操 選手班', enrolled: 12, maxStudents: 12, fillRate: 1, waitlistCount: 4 },
		{ id: 'c2', name: '兒童基礎 B 班', enrolled: 7, maxStudents: 10, fillRate: 0.7, waitlistCount: 0 }
	],
	coaches: [{ id: 'co1', name: '林雅婷', courseCount: 3, studentCount: 28, revenueCents12m: 85000000, attendanceRate: 0.92 }]
};

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(PAYLOAD);
});

describe('報表分析 (+page) — KPI band(6 卡)', () => {
	it('renders the 6 cards with real values and frontend-computed deltaPct pills', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('本月營收');
		expect(txt).toContain('NT$458,200');
		expect(txt).toContain('本月新會員');
		expect(txt).toContain('8 位');
		expect(txt).toContain('+60.0%'); // (8-5)/5
		expect(txt).toContain('本月新報名');
		expect(txt).toContain('14 筆');
		expect(txt).toContain('+40.0%'); // (14-10)/10
		expect(txt).toContain('本月訂單數');
		expect(txt).toContain('30 筆');
		expect(txt).toContain('-50.0%'); // (30-60)/60
		expect(txt).toContain('本月出席率');
		expect(txt).toContain('92%');
		expect(txt).toContain('+15.0%'); // (0.92-0.8)/0.8
		expect(txt).toContain('會員留存率');
		expect(txt).toContain('88%'); // retention 末桶 rate 0.884
	});

	it('留存率卡無環比資料源 → delta 恆為「—」的中性 pill', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		expect(container.querySelectorAll('.delta.none').length).toBe(1); // 僅留存卡
	});

	it('attendanceRate 兩月皆 null → 出席率卡 value 與 delta 都顯示「—」;retention 空 → 留存率「—」', async () => {
		vi.mocked(getReports).mockResolvedValue({
			...PAYLOAD,
			kpis: { ...PAYLOAD.kpis, attendanceRate: { thisMonth: null, lastMonth: null } },
			retention: []
		});
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('本月出席率');
		expect(txt).toContain('—');
		// 出席率 delta null + 留存率 delta 恆 null → 兩顆中性 pill
		expect(container.querySelectorAll('.delta.none').length).toBe(2);
	});
});

describe('報表分析 (+page) — 13 面板', () => {
	it('renders every restored panel title', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		for (const title of [
			'本月營收來源拆解',
			'月營收趨勢',
			'營收類別占比',
			'熱門課程排行',
			'收入來源分析',
			'教練表現排行',
			'場館使用時數',
			'出席率分布',
			'新生 vs 回訪',
			'年齡層分布',
			'會員分級分布',
			'付款方式占比',
			'試上洽詢 → 報名 轉換',
			'星期別出席負載'
		])
			expect(txt).toContain(title);
	});

	it('panels consume their ReportsData sections (spot checks through the page)', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('NT$312,000'); // RevenueBreakdown: course 毛額
		expect(txt).toContain('NT$466,900'); // RevenueBreakdown 合計 = Σ rows
		expect(txt).toContain('60%'); // CategoryDonut: course ratio
		expect(txt).toContain('競技體操 選手班'); // TopCourses ← topCoursesFrom(courses)
		expect(txt).toContain('12 人'); // TopCourses count = enrolled
		expect(txt).toContain('NT$3,000'); // IncomeSources: course 12 月加總
		expect(txt).toContain('NT$850,000'); // CoachPerf: revenueCents12m
		expect(txt).toContain('2.5 小時'); // VenueUsage: fmtHours(150)
		expect(txt).toContain('95–100%'); // AttDist bucket label
		expect(txt).toContain('留存 88%'); // RetentionTrend 末桶
		expect(txt).toContain('7–12 歲'); // AgeDist bucket label
		expect(txt).toContain('銅'); // TierDist TIER_LABEL
		expect(txt).toContain('信用卡'); // PaymentSplit paymentMethodLabel
		expect(txt).toContain('轉化 45%'); // ConversionFunnel 142/318
		expect(txt).toContain('318'); // funnel 試上洽詢數
	});

	it('renders the 12-month revenue trend chart with real month labels and a computed total', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		for (const t of PAYLOAD.revenue.trend) expect(txt).toContain(t.m);
		expect(txt).toContain('總計 NT$1,078,200'); // 300,000+320,000+458,200
	});
});

describe('報表分析 (+page) — 表格', () => {
	it('renders the courses table with fill rate and waitlist count', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('競技體操 選手班');
		expect(txt).toContain('12 / 12');
		expect(txt).toContain('100%');
		expect(txt).toContain('兒童基礎 B 班');
		expect(txt).toContain('7 / 10');
		expect(txt).toContain('70%');
	});

	it('renders the coaches table with course/student counts', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('林雅婷');
		expect(txt).toContain('3');
		expect(txt).toContain('28');
	});

	it('fillRate 為 null 時課程表格顯示「—」而非 0%', async () => {
		vi.mocked(getReports).mockResolvedValue({
			...PAYLOAD,
			courses: [{ id: 'c3', name: '空堂', enrolled: 0, maxStudents: 0, fillRate: null, waitlistCount: 0 }]
		});
		const { findByText, container } = render(ReportsPage);
		await findByText('報表分析');
		expect(container.textContent).toContain('—');
	});
});

describe('報表分析 (+page) — 空庫', () => {
	it('全 section 空/零時整頁仍渲染:KPI NT$0、面板空清單提示、無 NaN、不崩潰', async () => {
		const zeroTrend = Array.from({ length: 12 }, (_, i) => ({ m: `2025-${String(i + 1).padStart(2, '0')}`, h: 0 }));
		vi.mocked(getReports).mockResolvedValue({
			revenue: { thisMonth: 0, lastMonth: 0, trend: zeroTrend },
			...EMPTY_REPORT_SECTIONS,
			members: { total: 0, newThisMonth: 0, active: 0 },
			courses: [],
			coaches: []
		});
		const { findByText, container } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('NT$0'); // KPI 本月營收
		expect(txt).toContain('總計 NT$0'); // RevenueTrend:12 筆全 0,max 保底不產生 NaN
		for (const t of zeroTrend) expect(txt).toContain(t.m);
		// 開放集合面板的空清單提示
		expect(txt).toContain('尚無課程報名資料'); // TopCourses
		expect(txt).toContain('尚無收入資料'); // IncomeSources
		expect(txt).toContain('尚無教練資料'); // CoachPerf + coaches 表格
		expect(txt).toContain('本月尚無場地使用資料'); // VenueUsage
		expect(txt).toContain('本月尚無付款訂單'); // PaymentSplit
		expect(txt).toContain('轉化 —'); // ConversionFunnel 洽詢 0
		expect(txt).toContain('尚無課程資料'); // courses 表格
		expect(container.innerHTML).not.toContain('NaN');
	});
});

describe('報表分析 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockRejectedValue(new Error('network'));
		const { findByText } = render(ReportsPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架(6 張 KPI 骨架卡)', () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(ReportsPage);
		expect(getByTestId('reports-skeleton')).toBeTruthy();
	});
});
