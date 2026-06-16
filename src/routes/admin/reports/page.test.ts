import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReportsPage from './+page.svelte';
import { REPORT_KPIS } from '$lib/admin/data';
import { REPORT_PERIODS, DEFAULT_PERIOD, kpisForPeriod } from '$lib/admin/components/reports-period';

/* 報表分析 (reports.jsx ReportsView): a PageHead with a real period Select + 匯出報表,
 * the REPORT_KPIS band (now reactive to the period), and the 15 CSS charts. The
 * period Select re-scales only the KPI band (kpisForPeriod). */
describe('報表分析 (+page)', () => {
	it('renders the title and the default-period KPI values', () => {
		const { container } = render(ReportsPage);
		const txt = container.textContent ?? '';
		expect(txt).toContain('報表分析');
		// default band: 本月營收 NT$ 458,200 is shown verbatim
		const revenue = REPORT_KPIS.find((k) => k.label === '本月營收')!;
		expect(txt).toContain(revenue.value);
	});

	it('renders the period Select seeded with every REPORT_PERIODS option', () => {
		const { container } = render(ReportsPage);
		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select).not.toBeNull();
		const optionValues = [...select.options].map((o) => o.value);
		for (const p of REPORT_PERIODS) {
			expect(optionValues).toContain(p);
		}
		expect(select.value).toBe(DEFAULT_PERIOD);
	});

	it('re-scales a numeric KPI when the period Select changes', async () => {
		const { container } = render(ReportsPage);
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

	it('keeps a %-valued KPI honest across a period change', async () => {
		const { container } = render(ReportsPage);
		const select = container.querySelector('select') as HTMLSelectElement;
		const other = REPORT_PERIODS.find((p) => p !== DEFAULT_PERIOD)!;
		await fireEvent.change(select, { target: { value: other } });
		const att = REPORT_KPIS.find((k) => k.label === '平均出席率')!.value; // '91.2%'
		expect(container.textContent).toContain(att);
	});
});
