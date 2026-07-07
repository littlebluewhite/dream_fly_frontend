import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AdminHome from './+page.svelte';
import type { ReportsData } from '$lib/admin/api';
import { getReports, getMembers } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getReports: vi.fn(), getMembers: vi.fn() }));

/* 營運總覽 dashboard (admin.jsx AdminHome), re-scoped in Task 15 to real data: a KPI
 * StatCard row fed by GET /reports/admin, then the 今日課表 + 最新動態 panels and a
 * compact 學員名單 fed by GET /users. Both calls arrive through the async seam, so
 * every assertion first awaits the ready phase. */
const REPORTS: ReportsData = {
	revenue: { thisMonth: 458200, lastMonth: 400000, trend: [] },
	members: { total: 120, newThisMonth: 8, active: 96 },
	courses: [],
	coaches: []
};
const MEMBERS = [
	{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active' as const, points: 1250 }
];

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(REPORTS);
	vi.mocked(getMembers).mockReset();
	vi.mocked(getMembers).mockResolvedValue({ members: MEMBERS });
});

describe('admin dashboard (+page)', () => {
	it('renders the two real-data KPI StatCards (在學學員/本月營收) with values from GET /reports/admin', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		const txt = container.textContent ?? '';
		expect(txt).toContain('在學學員');
		expect(txt).toContain('96'); // members.active
		expect(txt).toContain('本月營收');
		expect(txt).toContain('NT$458,200'); // fmtNT(revenue.thisMonth)
	});

	it('does not render the removed 本週課堂/出席偏低 KPI cards (no /reports/admin data source)', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		const txt = container.textContent ?? '';
		expect(txt).not.toContain('本週課堂');
		expect(txt).not.toContain('出席偏低');
	});

	it('does not render a hardcoded date in the page sub-heading', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		expect(container.textContent).not.toContain('2026 年 6 月 10 日');
	});

	it('renders the 今日課表 and 最新動態 panels', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		const txt = container.textContent ?? '';
		expect(txt).toContain('今日課表');
		expect(txt).toContain('最新動態');
	});

	it('renders the compact 學員名單 panel fed by GET /users (getMembers())', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		expect(container.textContent).toContain('學員名單');
		expect(container.textContent).toContain('王小明');
	});
});

describe('admin dashboard — 三態', () => {
	it('error: 顯示「載入失敗」', async () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockRejectedValue(new Error('network'));
		const { findByText } = render(AdminHome);
		await findByText('載入失敗');
	});

	it('loading: 顯示骨架', () => {
		vi.mocked(getReports).mockReset();
		vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(AdminHome);
		expect(getByTestId('admin-home-skeleton')).toBeTruthy();
	});
});
