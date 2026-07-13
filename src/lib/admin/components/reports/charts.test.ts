import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';

import ReportKpi from './ReportKpi.svelte';
import RevenueBreakdown from './RevenueBreakdown.svelte';
import CategoryDonut from './CategoryDonut.svelte';
import TopCourses from './TopCourses.svelte';
import IncomeSources from './IncomeSources.svelte';
import CoachPerf from './CoachPerf.svelte';
import VenueUsage from './VenueUsage.svelte';
import AttDist from './AttDist.svelte';
import RetentionTrend from './RetentionTrend.svelte';
import AgeDist from './AgeDist.svelte';
import TierDist from './TierDist.svelte';
import PaymentSplit from './PaymentSplit.svelte';
import ConversionFunnel from './ConversionFunnel.svelte';
import WeekdayLoad from './WeekdayLoad.svelte';

import type {
	AdminRevenueBreakdownRow,
	AdminCategorySplitRow,
	AdminIncomeSourceRow,
	AdminPaymentSplitRow,
	AdminAttendanceDistRow,
	AdminAgeDistRow,
	AdminTierDistRow,
	AdminRetentionRow,
	AdminFunnel,
	AdminWeekdayLoadRow,
	AdminVenueUsageRow,
	AdminReportCoachRow
} from '$lib/admin/api';
import type { TopCourseRow } from '$lib/admin/report-math';

/* Round 4 P4-F2 — 13 個還原面板 + ReportKpi 卡的渲染測試。每個面板兩態:
 *   ① 真形狀資料(契約 §3.24 的 FE 型別 fixture)→ 標籤/數值/格式化正確畫出;
 *   ② 空庫資料(固定桶零填/開放集合空陣列,同契約空庫段落)→ 仍能渲染
 *      (零長條/空清單提示),且絕不輸出 NaN(normalizeBars/pctShares 防除零)。
 * 純 donutStops 數學在 donut.test.ts;此處只驗「元件把 props 資料畫出來」。 */

const noNaN = (container: HTMLElement) => expect(container.innerHTML).not.toContain('NaN');

/* ───────────────────────── ReportKpi(KPI 卡) ───────────────────────── */

describe('ReportKpi (KPI card)', () => {
	const base = {
		icon: 'dollar-sign' as const,
		label: '本月營收',
		value: 'NT$458,200',
		tint: '#0066CC14',
		color: 'var(--df-primary)'
	};

	it('renders label/value and formats a positive deltaPct as +X.X%', () => {
		const { container } = render(ReportKpi, { ...base, delta: 12.5 });
		expect(container.textContent).toContain('本月營收');
		expect(container.textContent).toContain('NT$458,200');
		expect(container.textContent).toContain('+12.5%');
	});

	it('formats a negative deltaPct with its sign and the down tone', () => {
		const { container } = render(ReportKpi, { ...base, delta: -3.25 });
		expect(container.textContent).toContain('-3.3%');
		expect(container.querySelector('.delta.down')).toBeTruthy();
	});

	it('delta null(分母不成立/無資料)renders「—」in the neutral pill', () => {
		const { container } = render(ReportKpi, { ...base, delta: null });
		expect(container.textContent).toContain('—');
		expect(container.querySelector('.delta.none')).toBeTruthy();
		noNaN(container);
	});
});

/* ───────────────────────── RevenueBreakdown ───────────────────────── */

const BREAKDOWN: AdminRevenueBreakdownRow[] = [
	{ source: 'course', grossCents: 31200000, ordersCount: 142, units: 150 },
	{ source: 'ticket', grossCents: 9840000, ordersCount: 60, units: 234 },
	{ source: 'membership', grossCents: 500000, ordersCount: 5, units: 5 },
	{ source: 'course_package', grossCents: 250000, ordersCount: 2, units: 2 },
	{ source: 'merchandise', grossCents: 4780000, ordersCount: 86, units: 90 },
	{ source: 'venue_rental', grossCents: 120000, ordersCount: 3, units: 3 }
];
const BREAKDOWN_ZERO: AdminRevenueBreakdownRow[] = BREAKDOWN.map((r) => ({
	...r,
	grossCents: 0,
	ordersCount: 0,
	units: 0
}));

describe('RevenueBreakdown (drill list)', () => {
	it('renders every source label, meta counts, fmtNT amount and a 合計 summed from the rows', () => {
		const { container } = render(RevenueBreakdown, { rows: BREAKDOWN });
		const txt = container.textContent ?? '';
		for (const label of ['課程報名', '單次票券', '月票方案', '課程套裝', '裝備週邊', '場地租借'])
			expect(txt).toContain(label);
		expect(txt).toContain('NT$312,000');
		expect(txt).toContain('訂單 142 筆 · 數量 150');
		expect(txt).toContain('NT$466,900'); // 合計 = Σ grossCents,非 revenue KPI 的實收口徑
	});

	it('空庫(6 桶全零)renders zero amounts and a NT$0 合計, no NaN', () => {
		const { container } = render(RevenueBreakdown, { rows: BREAKDOWN_ZERO });
		expect(container.textContent).toContain('NT$0');
		noNaN(container);
	});
});

/* ───────────────────────── CategoryDonut ───────────────────────── */

const CATEGORY: AdminCategorySplitRow[] = [
	{ source: 'course', grossCents: 31200000, ratio: 0.6 },
	{ source: 'ticket', grossCents: 9840000, ratio: 0.2 },
	{ source: 'membership', grossCents: 500000, ratio: 0.1 },
	{ source: 'course_package', grossCents: 250000, ratio: 0.05 },
	{ source: 'merchandise', grossCents: 4780000, ratio: 0.05 }
];
const CATEGORY_ZERO: AdminCategorySplitRow[] = CATEGORY.map((r) => ({
	...r,
	grossCents: 0,
	ratio: null
}));

describe('CategoryDonut (donut family)', () => {
	it('renders every category label + fmtPct ratio and a cumulative conic-gradient ring', () => {
		const { container } = render(CategoryDonut, { rows: CATEGORY });
		const txt = container.textContent ?? '';
		expect(txt).toContain('營收類別占比');
		expect(txt).toContain('課程報名');
		expect(txt).toContain('60%');
		expect(txt).toContain('5%');
		expect(txt).toContain('5'); // hub:有進帳類別數
		const ring = container.querySelector('.ring') as HTMLElement;
		expect(ring.getAttribute('style')).toContain('conic-gradient(');
		expect(ring.getAttribute('style')).toContain('0% 60%'); // 首段累積邊界
	});

	it('空庫(ratio 全 null)renders「—」per row, a neutral ring and hub 0, no NaN', () => {
		const { container } = render(CategoryDonut, { rows: CATEGORY_ZERO });
		expect(container.textContent).toContain('—');
		expect(container.textContent).toContain('0');
		const ring = container.querySelector('.ring') as HTMLElement;
		expect(ring.getAttribute('style')).not.toContain('conic-gradient(');
		noNaN(container);
	});
});

/* ───────────────────────── TopCourses ───────────────────────── */

const TOP: TopCourseRow[] = [
	{ rank: 1, name: '兒童體操初階班', count: 96 },
	{ rank: 2, name: '競技體操選手班', count: 78 }
];

describe('TopCourses (ranked bar list)', () => {
	it('renders rank, name, count and a normalizeBars width per course', () => {
		const { container } = render(TopCourses, { rows: TOP });
		expect(container.textContent).toContain('兒童體操初階班');
		expect(container.textContent).toContain('96 人');
		const widths = Array.from(container.querySelectorAll('.track > div')).map(
			(d) => (d as HTMLElement).style.width
		);
		expect(widths[0]).toBe('100%'); // 最大值滿版
	});

	it('空清單 renders the 尚無 hint, no NaN', () => {
		const { container } = render(TopCourses, { rows: [] });
		expect(container.textContent).toContain('尚無課程報名資料');
		noNaN(container);
	});
});

/* ───────────────────────── IncomeSources ───────────────────────── */

const INCOME: AdminIncomeSourceRow[] = [
	{ month: '2025-09', source: 'course', grossCents: 100000, ordersCount: 1, units: 1 },
	{ month: '2025-10', source: 'course', grossCents: 200000, ordersCount: 2, units: 2 },
	{ month: '2025-09', source: 'ticket', grossCents: 100000, ordersCount: 1, units: 1 },
	{ month: '2025-10', source: 'ticket', grossCents: 0, ordersCount: 0, units: 0 }
];

describe('IncomeSources (share bar list)', () => {
	it('sums each source over the months and renders fmtNT totals + fmtPct shares', () => {
		const { container } = render(IncomeSources, { rows: INCOME });
		const txt = container.textContent ?? '';
		expect(txt).toContain('課程報名');
		expect(txt).toContain('NT$3,000'); // 100000+200000 cents
		expect(txt).toContain('75% 占比');
		expect(txt).toContain('單次票券');
		expect(txt).toContain('NT$1,000');
		expect(txt).toContain('25% 占比');
	});

	it('空陣列 renders the 尚無 hint, no NaN', () => {
		const { container } = render(IncomeSources, { rows: [] });
		expect(container.textContent).toContain('尚無收入資料');
		noNaN(container);
	});
});

/* ───────────────────────── CoachPerf ───────────────────────── */

const COACHES: AdminReportCoachRow[] = [
	{ id: 'co2', name: '陳大明', courseCount: 1, studentCount: 12, revenueCents12m: 42500000, attendanceRate: null },
	{ id: 'co1', name: '林雅婷', courseCount: 3, studentCount: 28, revenueCents12m: 85000000, attendanceRate: 0.92 }
];

describe('CoachPerf (ranked horizontal-bar list)', () => {
	it('sorts by 12-month revenue, renders initial/name/fmtNT revenue/fmtPct 出席(null →「—」)', () => {
		const { container } = render(CoachPerf, { rows: COACHES });
		const txt = container.textContent ?? '';
		expect(txt).toContain('林雅婷');
		expect(txt).toContain('NT$850,000');
		expect(txt).toContain('出席 92%');
		expect(txt).toContain('出席 —'); // 陳大明 attendanceRate null
		// 排行:高營收在前
		expect(txt.indexOf('林雅婷')).toBeLessThan(txt.indexOf('陳大明'));
		expect((container.querySelector('.avatar') as HTMLElement).textContent).toContain('林');
	});

	it('空清單 renders the 尚無 hint; 全零營收 renders zero-width bars, no NaN', () => {
		const empty = render(CoachPerf, { rows: [] });
		expect(empty.container.textContent).toContain('尚無教練資料');
		const zero = render(CoachPerf, {
			rows: [{ id: 'c', name: '教練', courseCount: 0, studentCount: 0, revenueCents12m: 0, attendanceRate: null }]
		});
		expect((zero.container.querySelector('.track > div') as HTMLElement).style.width).toBe('0%');
		noNaN(zero.container);
	});
});

/* ───────────────────────── VenueUsage ───────────────────────── */

const VENUES: AdminVenueUsageRow[] = [
	{ venue: 'A 訓練館', minutes: 150 },
	{ venue: 'B 教室', minutes: 60 }
];

describe('VenueUsage (hours bar list)', () => {
	it('renders venue names with fmtHours and normalizeBars widths', () => {
		const { container } = render(VenueUsage, { rows: VENUES });
		expect(container.textContent).toContain('A 訓練館');
		expect(container.textContent).toContain('2.5 小時');
		expect(container.textContent).toContain('1 小時');
		const widths = Array.from(container.querySelectorAll('.track > div')).map(
			(d) => (d as HTMLElement).style.width
		);
		expect(widths).toEqual(['100%', '40%']);
	});

	it('空陣列(本月無場次)renders the 尚無 hint, no NaN', () => {
		const { container } = render(VenueUsage, { rows: [] });
		expect(container.textContent).toContain('本月尚無場地使用資料');
		noNaN(container);
	});
});

/* ───────────────────────── AttDist ───────────────────────── */

const ATT: AdminAttendanceDistRow[] = [
	{ bucket: 'gte_95', count: 11 },
	{ bucket: '85_94', count: 10 },
	{ bucket: '75_84', count: 5 },
	{ bucket: 'lt_75', count: 6 }
];

describe('AttDist (vertical-bar family)', () => {
	it('renders the 4 bucket labels + counts, tallest bar at 110px', () => {
		const { container } = render(AttDist, { rows: ATT });
		const txt = container.textContent ?? '';
		for (const label of ['95–100%', '85–94%', '75–84%', '低於 75%']) expect(txt).toContain(label);
		expect(txt).toContain('11');
		const heights = Array.from(container.querySelectorAll('.bar')).map(
			(b) => (b as HTMLElement).style.height
		);
		expect(heights[0]).toBe('110px');
	});

	it('固定桶全零 renders four 0px bars, no NaN', () => {
		const { container } = render(AttDist, { rows: ATT.map((r) => ({ ...r, count: 0 })) });
		const heights = Array.from(container.querySelectorAll('.bar')).map(
			(b) => (b as HTMLElement).style.height
		);
		expect(heights).toEqual(['0px', '0px', '0px', '0px']);
		noNaN(container);
	});
});

/* ───────────────────────── RetentionTrend ───────────────────────── */

const RETENTION: AdminRetentionRow[] = [
	{ month: '2025-05', newCount: 14, returningCount: 38, rate: null },
	{ month: '2025-06', newCount: 18, returningCount: 41, rate: 0.8 },
	{ month: '2025-07', newCount: 22, returningCount: 44, rate: 0.82 },
	{ month: '2025-08', newCount: 16, returningCount: 47, rate: 0.85 },
	{ month: '2025-09', newCount: 20, returningCount: 49, rate: 0.87 },
	{ month: '2025-10', newCount: 24, returningCount: 52, rate: 0.884 }
];

describe('RetentionTrend (stacked-bar family)', () => {
	it('renders month labels and the LAST bucket rate as 留存 fmtPct', () => {
		const { container } = render(RetentionTrend, { rows: RETENTION });
		const txt = container.textContent ?? '';
		expect(txt).toContain('留存 88%');
		expect(txt).toContain('2025-05');
		expect(txt).toContain('2025-10');
		expect(txt).toContain('新生(首次活躍)');
		const stacks = container.querySelectorAll('.stack');
		expect(stacks.length).toBe(6);
		expect((stacks[5] as HTMLElement).style.height).toBe('116px'); // 最大月滿高
	});

	it('全零 + rate null renders 留存「—」and zero-height stacks, no NaN', () => {
		const { container } = render(RetentionTrend, {
			rows: RETENTION.map((r) => ({ ...r, newCount: 0, returningCount: 0, rate: null }))
		});
		expect(container.textContent).toContain('留存 —');
		expect((container.querySelector('.stack') as HTMLElement).style.height).toBe('0px');
		noNaN(container);
	});
});

/* ───────────────────────── AgeDist ───────────────────────── */

const AGES: AdminAgeDistRow[] = [
	{ bucket: '0-6', count: 22 },
	{ bucket: '7-12', count: 34 },
	{ bucket: '13-17', count: 28 },
	{ bucket: '18-25', count: 16 },
	{ bucket: '26-40', count: 0 },
	{ bucket: '41+', count: 0 }
];

describe('AgeDist (share bar list)', () => {
	it('renders the 6 bucket labels and pctShares-derived fmtPct values', () => {
		const { container } = render(AgeDist, { rows: AGES });
		const txt = container.textContent ?? '';
		for (const label of ['0–6 歲', '7–12 歲', '13–17 歲', '18–25 歲', '26–40 歲', '41 歲以上'])
			expect(txt).toContain(label);
		expect(txt).toContain('34%'); // 34/100
		expect(txt).toContain('22%');
	});

	it('固定桶全零 renders 0% shares, no NaN', () => {
		const { container } = render(AgeDist, { rows: AGES.map((r) => ({ ...r, count: 0 })) });
		expect(container.textContent).toContain('0%');
		noNaN(container);
	});
});

/* ───────────────────────── TierDist ───────────────────────── */

const TIERS: AdminTierDistRow[] = [
	{ bucket: 'regular', count: 10 },
	{ bucket: 'bronze', count: 16 },
	{ bucket: 'silver', count: 13 },
	{ bucket: 'gold', count: 9 }
];

describe('TierDist (vertical-bar family)', () => {
	it('renders TIER_LABEL labels + counts, tallest bar at 100px', () => {
		const { container } = render(TierDist, { rows: TIERS });
		const txt = container.textContent ?? '';
		for (const label of ['一般', '銅', '銀', '金']) expect(txt).toContain(label);
		expect(txt).toContain('16');
		const heights = Array.from(container.querySelectorAll('.bar')).map(
			(b) => (b as HTMLElement).style.height
		);
		expect(heights[1]).toBe('100px');
	});

	it('固定桶全零 renders 0px bars, no NaN', () => {
		const { container } = render(TierDist, { rows: TIERS.map((r) => ({ ...r, count: 0 })) });
		expect((container.querySelector('.bar') as HTMLElement).style.height).toBe('0px');
		noNaN(container);
	});
});

/* ───────────────────────── PaymentSplit ───────────────────────── */

const PAYMENTS: AdminPaymentSplitRow[] = [
	{ method: 'credit_card', count: 46 },
	{ method: 'line_pay', count: 24 },
	{ method: 'weird_pay', count: 30 }
];

describe('PaymentSplit (donut family)', () => {
	it('renders paymentMethodLabel legends(查無 → 原字串), pctShares fmtPct and the hub 管道數', () => {
		const { container } = render(PaymentSplit, { rows: PAYMENTS });
		const txt = container.textContent ?? '';
		expect(txt).toContain('信用卡');
		expect(txt).toContain('LINE Pay');
		expect(txt).toContain('weird_pay'); // 未知 method 原樣穿透
		expect(txt).toContain('46%');
		expect(txt).toContain('3'); // hub:種管道
		const ring = container.querySelector('.ring') as HTMLElement;
		expect(ring.getAttribute('style')).toContain('conic-gradient(');
	});

	it('空陣列(本月零筆)renders the hint and a neutral ring, no NaN', () => {
		const { container } = render(PaymentSplit, { rows: [] });
		expect(container.textContent).toContain('本月尚無付款訂單');
		const ring = container.querySelector('.ring') as HTMLElement;
		expect(ring.getAttribute('style')).not.toContain('conic-gradient(');
		noNaN(container);
	});
});

/* ───────────────────────── ConversionFunnel ───────────────────────── */

describe('ConversionFunnel (honest 2 段)', () => {
	it('renders 試上洽詢/完成報名 counts and the fmtPct 轉化率', () => {
		const funnel: AdminFunnel = { trialInquiries: 318, newEnrolments: 142 };
		const { container } = render(ConversionFunnel, { funnel });
		const txt = container.textContent ?? '';
		expect(txt).toContain('試上洽詢');
		expect(txt).toContain('318');
		expect(txt).toContain('完成報名');
		expect(txt).toContain('142');
		expect(txt).toContain('轉化 45%'); // 142/318
		expect(txt).toContain('近 90 天');
		const widths = Array.from(container.querySelectorAll('.track > div')).map(
			(d) => (d as HTMLElement).style.width
		);
		expect(widths[0]).toBe('100%');
	});

	it('洽詢 0 renders 轉化「—」and zero-width bars, no NaN', () => {
		const { container } = render(ConversionFunnel, {
			funnel: { trialInquiries: 0, newEnrolments: 0 }
		});
		expect(container.textContent).toContain('轉化 —');
		const widths = Array.from(container.querySelectorAll('.track > div')).map(
			(d) => (d as HTMLElement).style.width
		);
		expect(widths).toEqual(['0%', '0%']);
		noNaN(container);
	});
});

/* ───────────────────────── WeekdayLoad ───────────────────────── */

const WEEK: AdminWeekdayLoadRow[] = [9, 8, 11, 9, 12, 10, 14].map((presentCount, weekday) => ({
	weekday,
	presentCount
}));

describe('WeekdayLoad (vertical-bar family)', () => {
	it('renders one bar per weekday(0=週日)with WEEKDAY_LABEL and present counts', () => {
		const { container } = render(WeekdayLoad, { rows: WEEK });
		const txt = container.textContent ?? '';
		for (const label of ['日', '一', '二', '三', '四', '五', '六']) expect(txt).toContain(label);
		expect(txt).toContain('14');
		const bars = container.querySelectorAll('.bar');
		expect(bars.length).toBe(7);
		// 最忙的星期六滿高 + primary-dark 強調
		expect((bars[6] as HTMLElement).style.height).toBe('104px');
		expect((bars[6] as HTMLElement).getAttribute('style')).toContain('var(--df-primary-dark)');
	});

	it('固定 7 桶全零 renders 0px bars without the busiest highlight, no NaN', () => {
		const { container } = render(WeekdayLoad, {
			rows: WEEK.map((r) => ({ ...r, presentCount: 0 }))
		});
		const bars = container.querySelectorAll('.bar');
		expect((bars[0] as HTMLElement).style.height).toBe('0px');
		expect((bars[0] as HTMLElement).getAttribute('style')).not.toContain('var(--df-primary-dark)');
		noNaN(container);
	});
});
