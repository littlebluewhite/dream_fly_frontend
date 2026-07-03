import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReportsPage from './+page.svelte';
import {
	REPORT_KPIS,
	REVENUE_BREAKDOWN,
	REVENUE_TOTAL,
	REVENUE_TREND,
	CATEGORY_SPLIT,
	TOP_COURSES,
	INCOME_SOURCES,
	COACH_PERF,
	VENUE_USAGE,
	ATT_DIST,
	RETENTION,
	AGE_DIST,
	TIER_DIST,
	CAMPUS_REVENUE,
	PAYMENT_SPLIT,
	FUNNEL,
	WEEKDAY_LOAD
} from '$lib/admin/data';
import { REPORT_PERIODS, DEFAULT_PERIOD, kpisForPeriod } from '$lib/admin/components/reports-period';
import { getReports } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getReports: vi.fn() }));

/** getReports() 的完整 seed 聚合 — 頁面把每個資料集下傳給對應圖表元件。 */
const PAYLOAD = {
	kpis: REPORT_KPIS,
	revenueBreakdown: REVENUE_BREAKDOWN,
	revenueTotal: REVENUE_TOTAL,
	revenueTrend: REVENUE_TREND,
	categorySplit: CATEGORY_SPLIT,
	topCourses: TOP_COURSES,
	incomeSources: INCOME_SOURCES,
	coachPerf: COACH_PERF,
	venueUsage: VENUE_USAGE,
	attDist: ATT_DIST,
	retention: RETENTION,
	ageDist: AGE_DIST,
	tierDist: TIER_DIST,
	campusRevenue: CAMPUS_REVENUE,
	paymentSplit: PAYMENT_SPLIT,
	funnel: FUNNEL,
	weekdayLoad: WEEKDAY_LOAD
};

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(PAYLOAD);
});

/* 報表分析 (reports.jsx ReportsView): a PageHead with a real period Select + 匯出報表,
 * the KPI band (reactive to the period), and the 15 CSS charts fed from the same
 * getReports() payload via required props. The period Select re-scales only the
 * KPI band (kpisForPeriod). Data arrives through the seam (async), so every
 * assertion first awaits the ready phase. */
describe('報表分析 (+page)', () => {
	it('renders the title and the default-period KPI values', async () => {
		const revenue = REPORT_KPIS.find((k) => k.label === '本月營收')!;
		const { container, findByText } = render(ReportsPage);
		// default band: 本月營收 NT$ 458,200 is shown verbatim
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain('報表分析');
		expect(txt).toContain(revenue.value);
	});

	it('renders the period Select seeded with every REPORT_PERIODS option', async () => {
		const revenue = REPORT_KPIS.find((k) => k.label === '本月營收')!;
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select).not.toBeNull();
		const optionValues = [...select.options].map((o) => o.value);
		for (const p of REPORT_PERIODS) {
			expect(optionValues).toContain(p);
		}
		expect(select.value).toBe(DEFAULT_PERIOD);
	});

	it('re-scales a numeric KPI when the period Select changes', async () => {
		const revenue = REPORT_KPIS.find((k) => k.label === '本月營收')!;
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const select = container.querySelector('select') as HTMLSelectElement;
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;

		// the default value is on screen before the change
		const enrollBase = REPORT_KPIS.find((k) => k.label === '課程報名')!.value; // '142 筆'
		expect(container.textContent).toContain(enrollBase);

		await fireEvent.change(select, { target: { value: other } });

		const scaled = kpisForPeriod(REPORT_KPIS, other);
		const enrollScaled = scaled[REPORT_KPIS.findIndex((k) => k.label === '課程報名')].value;
		expect(enrollScaled).not.toBe(enrollBase); // sanity: the window actually moved it
		expect(container.textContent).toContain(enrollScaled);
	});

	it('feeds every chart from the seam payload (抽樣斷言各圖表資料上畫面)', async () => {
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const txt = container.textContent ?? '';
		expect(txt).toContain(REVENUE_TOTAL); // RevenueBreakdown 合計
		expect(txt).toContain(TOP_COURSES[0].name); // TopCourses 排行第 1 名
		expect(txt).toContain(VENUE_USAGE[0].hours); // VenueUsage 時數
		expect(txt).toContain(INCOME_SOURCES[0].amount); // IncomeSources 金額
		expect(txt).toContain(CAMPUS_REVENUE[0].name); // CampusRevenue 分校名
		expect(txt).toContain(`轉化 ${Math.round((FUNNEL[1].pct / FUNNEL[0].pct) * 100)}%`); // ConversionFunnel 逐步轉化
	});

	it('keeps a %-valued KPI honest across a period change', async () => {
		const revenue = REPORT_KPIS.find((k) => k.label === '本月營收')!;
		const { container, findByText } = render(ReportsPage);
		await findByText('報表分析');
		const select = container.querySelector('select') as HTMLSelectElement;
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		await fireEvent.change(select, { target: { value: other } });
		const att = REPORT_KPIS.find((k) => k.label === '平均出席率')!.value; // '91.2%'
		expect(container.textContent).toContain(att);
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
