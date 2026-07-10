import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportsPage from './+page.svelte';
import type { ReportsData } from '$lib/admin/api';
import { getReports } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getReports: vi.fn() }));

/* 報表分析 (reports.jsx ReportsView, re-scoped Task 15): a PageHead with 匯出報表,
 * a real-data KPI band (revenue this/last month + member counts), the 12-month
 * RevenueTrend chart, and two honest courses/coaches tables. Data arrives through
 * the getReports() seam (async), so every assertion first awaits the ready phase. */
// Round 4 P4-F1：ReportsData 新增 12 組金流/人流彙總 sections + coaches[] 兩新欄——
// 此頁(P4-F2 之前)尚未消費，fixture 補齊型別必要欄位即可，皆給誠實的全 0/空陣列/null。
const EMPTY_REPORT_SECTIONS = {
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
	...EMPTY_REPORT_SECTIONS,
	members: { total: 120, newThisMonth: 8, active: 96 },
	courses: [
		{ id: 'c1', name: '競技體操 選手班', enrolled: 12, maxStudents: 12, fillRate: 1, waitlistCount: 4 },
		{ id: 'c2', name: '兒童基礎 B 班', enrolled: 7, maxStudents: 10, fillRate: 0.7, waitlistCount: 0 }
	],
	coaches: [{ id: 'co1', name: '林雅婷', courseCount: 3, studentCount: 28, revenueCents12m: 850000, attendanceRate: 0.92 }]
};

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(PAYLOAD);
});

describe('報表分析 (+page)', () => {
	it('renders the title and the real revenue/member KPI values', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('本月營收');
		expect(txt).toContain('NT$458,200');
		expect(txt).toContain('上月營收');
		expect(txt).toContain('NT$400,000');
		expect(txt).toContain('會員總數');
		expect(txt).toContain('120');
		expect(txt).toContain('本月新增會員');
		expect(txt).toContain('8');
		expect(txt).toContain('在學會員');
		expect(txt).toContain('96');
	});

	it('renders the 12-month revenue trend chart with real month labels and a computed total', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		for (const t of PAYLOAD.revenue.trend) expect(txt).toContain(t.m);
		expect(txt).toContain('總計 NT$1,078,200'); // 300,000+320,000+458,200
	});

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

	it('空庫：revenue 全 0(12 筆 trend 皆 0)、courses/coaches 皆空陣列時顯示尚無資料，不是空白或崩潰', async () => {
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
		expect(txt).toContain('尚無課程資料');
		expect(txt).toContain('尚無教練資料');
		expect(txt).toContain('NT$0'); // KPI 帶本月/上月營收
		expect(txt).toContain('總計 NT$0'); // RevenueTrend：12 筆全 0，max 保底 1 不產生 NaN
		for (const t of zeroTrend) expect(txt).toContain(t.m);
	});
});

describe('報表分析 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockRejectedValue(new Error('network'));
		const { findByText } = render(ReportsPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(ReportsPage);
		expect(getByTestId('reports-skeleton')).toBeTruthy();
	});
});
