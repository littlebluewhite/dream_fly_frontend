import { describe, it, expect } from 'vitest';
import { REPORT_KPIS } from '$lib/admin/data';
import { REPORT_PERIODS, DEFAULT_PERIOD, kpisForPeriod } from './reports-period';

/* reports-period — the 報表分析 period picker. REPORT_PERIODS is the dropdown
 * source; kpisForPeriod(base, key) re-scales the numeric token out of each
 * pre-formatted REPORT_KPIS.value for non-default periods while leaving %-valued
 * KPIs honest (a ratio does not scale with the window). The 15 charts import data
 * at module scope and are NOT touched — period only re-scales the KPI band. */
describe('REPORT_PERIODS', () => {
	it('lists the selectable periods with the default first', () => {
		expect(REPORT_PERIODS.length).toBeGreaterThanOrEqual(3);
		expect(REPORT_PERIODS[0]).toBe(DEFAULT_PERIOD);
		expect(REPORT_PERIODS).toContain('2026 上半年');
	});
});

describe('kpisForPeriod', () => {
	it('returns the base band unchanged for the default period (same values + length)', () => {
		const out = kpisForPeriod(REPORT_KPIS, DEFAULT_PERIOD);
		expect(out).toHaveLength(REPORT_KPIS.length);
		expect(out.map((k) => k.value)).toEqual(REPORT_KPIS.map((k) => k.value));
	});

	it('preserves the KPI labels/icons/colors (only value is re-scaled)', () => {
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		const out = kpisForPeriod(REPORT_KPIS, other);
		expect(out.map((k) => k.label)).toEqual(REPORT_KPIS.map((k) => k.label));
		expect(out.map((k) => k.icon)).toEqual(REPORT_KPIS.map((k) => k.icon));
		expect(out.map((k) => k.color)).toEqual(REPORT_KPIS.map((k) => k.color));
	});

	it('changes a numeric KPI for a non-default period', () => {
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		const out = kpisForPeriod(REPORT_KPIS, other);
		// 課程報名 is '142 筆' — a plain count, must move for a different window
		const i = REPORT_KPIS.findIndex((k) => k.label === '課程報名');
		expect(out[i].value).not.toBe(REPORT_KPIS[i].value);
	});

	it('keeps the numeric formatting shape (suffix / NT$ prefix / thousands)', () => {
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		const out = kpisForPeriod(REPORT_KPIS, other);
		const enroll = out[REPORT_KPIS.findIndex((k) => k.label === '課程報名')];
		expect(enroll.value).toMatch(/^\d[\d,]*\s筆$/); // still "<number> 筆"
		const revenue = out[REPORT_KPIS.findIndex((k) => k.label === '本月營收')];
		expect(revenue.value).toMatch(/^NT\$ [\d,]+$/); // still "NT$ <number>"
	});

	it('leaves %-valued KPIs honest (a ratio does not scale with the window)', () => {
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		const out = kpisForPeriod(REPORT_KPIS, other);
		for (let i = 0; i < REPORT_KPIS.length; i++) {
			if (REPORT_KPIS[i].value.includes('%')) {
				expect(out[i].value).toBe(REPORT_KPIS[i].value);
			}
		}
		// sanity: 平均出席率 (91.2%) is one of them and is unchanged
		const att = REPORT_KPIS.findIndex((k) => k.label === '平均出席率');
		expect(out[att].value).toBe(REPORT_KPIS[att].value);
	});

	it('never mutates the input array or its KPI objects', () => {
		const beforeValues = REPORT_KPIS.map((k) => k.value);
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		kpisForPeriod(REPORT_KPIS, other);
		expect(REPORT_KPIS.map((k) => k.value)).toEqual(beforeValues);
	});
});
