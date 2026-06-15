import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AdminHome from './+page.svelte';

/* 營運總覽 dashboard (admin.jsx AdminHome): a 4-up KPI StatCard grid, then the
 * 今日課表 + 最新動態 panels and a compact 學員名單. The KPI values are static
 * literals in the prototype, so we assert a couple of label/value pairs render. */
describe('admin dashboard (+page)', () => {
	it('renders the four KPI StatCards with their labels and values', () => {
		const { container } = render(AdminHome);
		const txt = container.textContent ?? '';
		// 在學學員 248
		expect(txt).toContain('在學學員');
		expect(txt).toContain('248');
		// 本月營收 NT$182K
		expect(txt).toContain('本月營收');
		expect(txt).toContain('NT$182K');
		// 本週課堂 64 · 出席偏低 6
		expect(txt).toContain('本週課堂');
		expect(txt).toContain('出席偏低');
	});

	it('renders the 今日課表 and 最新動態 panels', () => {
		const { container } = render(AdminHome);
		const txt = container.textContent ?? '';
		expect(txt).toContain('今日課表');
		expect(txt).toContain('最新動態');
	});

	it('renders the compact 學員名單 panel', () => {
		const { container } = render(AdminHome);
		expect(container.textContent).toContain('學員名單');
	});
});
