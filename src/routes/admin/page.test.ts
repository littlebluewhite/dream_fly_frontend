import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AdminHome from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES } from '$lib/testing/admin-routes';
import { activityItem, adminReportResponse, todaySession, userResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，四支 getter 走真 mapper(GET /reports/admin、
 * GET /users?page=1、GET /sessions/today、GET /reports/admin/activity)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 營運總覽 dashboard (admin.jsx AdminHome), re-scoped in Task 15 to real data: a KPI
 * StatCard row fed by GET /reports/admin, then the 今日課表 + 最新動態 panels and a
 * compact 學員名單 fed by GET /users. Both calls arrive through the async seam, so
 * every assertion first awaits the ready phase.
 *
 * Task F11: 今日課表/最新動態面板改吃 getTodaySessions()/getRecentActivity()(GET
 * /sessions/today admin 分支 + GET /reports/admin/activity)真資料，隨同一個
 * Promise.all 併入。 */
// 此頁(dashboard KPI 帶)只消費 revenue/members——其餘 section 用 builder 的空庫預設。
const REPORTS = adminReportResponse({
	revenue: { this_month_cents: 45820000, last_month_cents: 40000000, trend: [] },
	members: { total: 120, new_this_month: 8, active: 96 }
});
const MEMBERS = [
	userResponse({ id: 'u1', name: '王小明', phone: '0912345678', created_at: '2026-01-15T00:00:00Z', points_balance: 1250 })
];
const TODAY_SESSIONS = [
	todaySession({ course_name: '兒童基礎 B 班', coach_name: '陳冠宇', venue: 'B 教室', start_time: '17:30:00', enrolled_count: 8, status: 'ongoing' })
];
const RECENT_ACTIVITY = { items: [activityItem({ kind: 'user', label: '新會員註冊:謝佩珊', occurred_at: '2026-07-10T09:12:00Z' })] };

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(
			{
				'GET /reports/admin': REPORTS,
				'GET /users?page=1': { users: MEMBERS, total: MEMBERS.length, page: 1, per_page: 20 },
				'GET /sessions/today': TODAY_SESSIONS,
				'GET /reports/admin/activity': RECENT_ACTIVITY,
				...overrides
			},
			ADMIN_ROUTES
		)
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
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

	it('renders the 今日課表 and 最新動態 panels fed by getTodaySessions()/getRecentActivity() (Task F11)', async () => {
		const { container, findByText } = render(AdminHome);
		await findByText('在學學員');
		const txt = container.textContent ?? '';
		expect(txt).toContain('今日課表');
		expect(txt).toContain('最新動態');
		expect(txt).toContain('兒童基礎 B 班'); // TODAY_SESSIONS 真資料
		expect(txt).toContain('新會員註冊:謝佩珊'); // RECENT_ACTIVITY 真資料
		expect(txt).toContain('全館 1 堂課'); // sub 隨真實場次數動態產生，不再硬編「5 堂課」
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
		route({ 'GET /reports/admin': new Error('network') });
		const { findByText } = render(AdminHome);
		await findByText('載入失敗');
	});

	it('loading: 顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(AdminHome);
		expect(getByTestId('admin-home-skeleton')).toBeTruthy();
	});
});
