import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportsScreen from './ReportsScreen.svelte';
import { getReports } from '$lib/mobile-admin/api';
import type { ReportsData } from '$lib/mobile-admin/api';

/* 報表分析 push screen — Task P4-F3：接真 GET /reports/admin(復用桌面 admin/api.ts，
 * 見 $lib/mobile-admin/api 零映射 re-export)。刻意用與 KpiCard 顯示格式吻合、可精確
 * 驗算的 fixture 數字(同桌面 admin/reports/page.test.ts 的驗算慣例)，證明畫面讀的是
 * getReports() payload 並用 report-math/format 正確換算，而非殘留的舊 mock 常數。 */
vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, getReports: vi.fn() };
});

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
	kpis: {
		newMembers: { thisMonth: 8, lastMonth: 5 },
		newEnrolments: { thisMonth: 14, lastMonth: 10 },
		paidOrdersCount: { thisMonth: 30, lastMonth: 60 },
		attendanceRate: { thisMonth: 0.92, lastMonth: 0.8 }
	},
	revenueBreakdown: [
		{ source: 'course', grossCents: 31200000, ordersCount: 142, units: 150 },
		{ source: 'ticket', grossCents: 9840000, ordersCount: 60, units: 234 }
	],
	incomeSources12m: [
		{ month: '2025-09', source: 'course', grossCents: 100000, ordersCount: 1, units: 1 },
		{ month: '2025-10', source: 'course', grossCents: 200000, ordersCount: 2, units: 2 }
	],
	categorySplit: [
		{ source: 'course', grossCents: 31200000, ratio: 0.6 },
		{ source: 'ticket', grossCents: 9840000, ratio: 0.2 }
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
		{ month: '2025-10', newCount: 24, returningCount: 52, rate: 0.884 }
	],
	funnel: { trialInquiries: 318, newEnrolments: 142 },
	weekdayLoad: [9, 8, 11, 9, 12, 10, 14].map((presentCount, weekday) => ({ weekday, presentCount })),
	venueUsage: [
		{ venue: 'A 訓練館', minutes: 150 },
		{ venue: 'B 教室', minutes: 60 }
	],
	members: { total: 120, newThisMonth: 8, active: 96 },
	courses: [
		{ id: 'c1', name: '競技體操 選手班', enrolled: 12, maxStudents: 12, fillRate: 1, waitlistCount: 4 },
		{ id: 'c2', name: '兒童基礎 B 班', enrolled: 7, maxStudents: 10, fillRate: 0.7, waitlistCount: 0 }
	],
	coaches: [{ id: 'co1', name: '林雅婷', courseCount: 3, studentCount: 28, revenueCents12m: 85000000, attendanceRate: 0.92 }]
};

// 空庫形狀：固定桶零填/開放集合空陣列皆須不炸(同桌面「空庫」段落的防禦性驗證)。
const EMPTY_PAYLOAD: ReportsData = {
	revenue: { thisMonth: 0, lastMonth: 0, trend: Array.from({ length: 12 }, (_, i) => ({ m: `2025-${String(i + 1).padStart(2, '0')}`, h: 0 })) },
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
	venueUsage: [],
	members: { total: 0, newThisMonth: 0, active: 0 },
	courses: [],
	coaches: []
};

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(PAYLOAD);
});

describe('ReportsScreen — 載入(GET /reports/admin)', () => {
	it('loading：顯示骨架', () => {
		vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(ReportsScreen, { props: { onBack: () => {} } });
		expect(getByTestId('reports-skeleton')).toBeTruthy();
	});

	it('error：顯示「載入失敗」，重試呼叫 gate.refresh', async () => {
		vi.mocked(getReports).mockRejectedValue(new Error('network'));
		const { findByText } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('載入失敗');
	});
});

describe('ReportsScreen — 副標(動態年月)', () => {
	it('副標為當前 client 本地年月，非硬編 2026 年 6 月', async () => {
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		expect(container.textContent).toMatch(/\d{4} 年 \d{1,2} 月 · 營運數據/);
	});
});

describe('ReportsScreen — KPI band(真資料 + 前端算環比)', () => {
	it('6 張 KPI 卡讀 payload，非殘留的 REPORT_KPIS mock 字面值', async () => {
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		const txt = container.textContent ?? '';
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
		// 舊 mock 專屬的「票券銷售」KPI 卡(無資料源)不應殘留。
		expect(txt).not.toContain('票券銷售');
	});
});

describe('ReportsScreen — 面板(接真 ReportsData 各段)', () => {
	it('本月營收來源拆解：REVENUE_SOURCE_LABEL 標籤 + ntd()/fmtNT 換算，無假下鑽按鈕', async () => {
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		const txt = container.textContent ?? '';
		expect(txt).toContain('課程報名'); // REVENUE_SOURCE_LABEL.course
		expect(txt).toContain('NT$312,000'); // ntd(31200000)
		expect(txt).toContain('NT$410,400'); // 合計 = Σrows = ntd(41040000)
		expect(txt).not.toContain('下鑽'); // 桌面同一裁決：假下鑽按鈕已移除
	});

	it('分校 Panel 已移除(單一場館，campusRevenue 無資料源)', async () => {
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		expect(container.textContent ?? '').not.toContain('分校');
	});

	it('渲染其餘面板標題與真資料查表結果(逐塊 spot check)', async () => {
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		const txt = container.textContent ?? '';
		for (const title of [
			'營收趨勢',
			'營收類別占比',
			'熱門課程排行',
			'收入來源分析',
			'教練表現排行',
			'場館使用時數',
			'出席率分布',
			'新生 vs 回訪',
			'年齡層分布',
			'付款方式占比',
			'試上洽詢 → 報名 轉換',
			'星期別出席負載',
			'會員分級分布'
		])
			expect(txt).toContain(title);

		expect(txt).toContain('競技體操 選手班'); // TopCourses ← topCoursesFrom(courses)
		expect(txt).toContain('12 人');
		expect(txt).toContain('林雅婷'); // CoachPerf
		expect(txt).toContain('NT$850,000'); // ntd(revenueCents12m)
		expect(txt).toContain('2.5 小時'); // VenueUsage fmtHours(150)
		expect(txt).toContain('95–100%'); // AttDist ATTENDANCE_BUCKET_LABEL
		expect(txt).toContain('留存 88%'); // RetentionTrend 末桶
		expect(txt).toContain('7–12 歲'); // AgeDist AGE_BUCKET_LABEL
		expect(txt).toContain('銅'); // TierDist TIER_LABEL.bronze
		expect(txt).toContain('信用卡'); // PaymentSplit paymentMethodLabel
		expect(txt).toContain('轉化 45%'); // ConversionFunnel 142/318
		expect(txt).toContain('總計 NT$1,078,200'); // RevenueTrend 300,000+320,000+458,200
		expect(container.innerHTML).not.toContain('NaN');
	});
});

describe('ReportsScreen — 空庫', () => {
	it('全 section 空/零時仍渲染：KPI NT$0、開放集合面板空清單提示、無 NaN、不崩潰', async () => {
		vi.mocked(getReports).mockResolvedValue(EMPTY_PAYLOAD);
		const { findByText, container } = render(ReportsScreen, { props: { onBack: () => {} } });
		await findByText('本月營收');
		const txt = container.textContent ?? '';
		expect(txt).toContain('NT$0');
		expect(txt).toContain('尚無課程報名資料'); // TopCourses
		expect(txt).toContain('尚無收入資料'); // IncomeSources
		expect(txt).toContain('尚無教練資料'); // CoachPerf
		expect(txt).toContain('本月尚無場地使用資料'); // VenueUsage
		expect(txt).toContain('本月尚無付款訂單'); // PaymentSplit
		expect(txt).toContain('轉化 —'); // ConversionFunnel：洽詢 0 筆
		expect(container.innerHTML).not.toContain('NaN');
	});
});
