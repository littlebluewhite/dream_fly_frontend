/* Dream Fly — 管理後台 · 報表分析 period picker (reports.jsx ReportsView).
 *
 * The prototype's period control is decorative. Here it drives one honest,
 * front-end-only re-scale: kpisForPeriod() scales the numeric token out of each
 * pre-formatted REPORT_KPIS.value string by the selected window's factor, while
 * leaving %-valued KPIs untouched (a留存率 / 出席率 ratio does not grow with the
 * window). The 15 charts render their getReports() payload datasets (passed down
 * as props) as-is — the period re-scales the KPI band only, matching the
 * prototype, where the period control never touched the charts. */

import type { ReportKpi } from '$lib/admin/data';

/** The default (current) window — kpisForPeriod returns the base band for it. */
export const DEFAULT_PERIOD = '2026 上半年';

/** Dropdown source. The default sits first so it is the initial selection. */
export const REPORT_PERIODS: string[] = [DEFAULT_PERIOD, '2025 下半年', '近 12 個月'];

/** Per-period scale factor applied to the numeric (non-%) KPI tokens. */
const PERIOD_FACTOR: Record<string, number> = {
	[DEFAULT_PERIOD]: 1,
	'2025 下半年': 0.82,
	'近 12 個月': 1.93
};

/**
 * Re-scale the numeric token in a single pre-formatted value string by `factor`,
 * preserving the surrounding prefix/suffix (e.g. "NT$ ", " 筆") and re-applying
 * thousands separators. A value with no numeric token is returned unchanged.
 */
function scaleValue(value: string, factor: number): string {
	// first run of digits, optionally with thousands commas / a decimal part
	return value.replace(/\d[\d,]*(\.\d+)?/, (token) => {
		const n = parseFloat(token.replace(/,/g, ''));
		if (Number.isNaN(n)) return token;
		const scaled = Math.round(n * factor);
		return scaled.toLocaleString('en-US');
	});
}

/**
 * Scale the KPI band for the selected period. Returns a fresh array of fresh KPI
 * objects; the input is never mutated. %-valued KPIs (ratios) pass through
 * unchanged, and the default period returns the base values verbatim.
 */
export function kpisForPeriod(base: ReportKpi[], period: string): ReportKpi[] {
	const factor = PERIOD_FACTOR[period] ?? 1;
	return base.map((k) => {
		if (factor === 1 || k.value.includes('%')) return { ...k };
		return { ...k, value: scaleValue(k.value, factor) };
	});
}
