import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AdminHomePage from './+page.svelte';
import { overlay, toasts, members, hydrateOps, resetOpsForTests } from '$lib/mobile-admin/stores';
import { MEMBERS } from '$lib/mobile-admin/data';
import type { CreateMemberBody } from '$lib/mobile-admin/api';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';
import type { ApiTodaySession } from '$lib/api/wire';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getAdminHome/
 * createMember/getOpsCollections(getAdminHome 為組合器，3b 留任)走真實 fetch
 * adapter。今日課表的 tone/label 現一律由真實 SESSION_STATUS 查表(依 state)推導,
 * 不再是呼叫端可任意指定的獨立欄位——「label 與 state 脫鉤」這兩則舊回歸測試在
 * wire 層已無法構造出矛盾輸入(SESSION_STATUS 是唯一來源),故改測「只有 state 才
 * 決定橫幅、tone/label 不是頁面自己判斷」這件事仍成立即可(見下方兩則同義測試)。
 * state 由 deriveSessionStatus() 依牆鐘時間比較 start_time/end_time 推導(見
 * $lib/domain/sessions)：用極端時間窗規避跑測試當下實際時刻，不需要 fake timers
 * (元件測試混 fake timers 容易卡住 @testing-library 的 waitFor 輪詢)。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// 00:00:00–23:59:59 幾乎必然落在「進行中」；23:59:58–23:59:59 幾乎必然「尚未開始」
// (deriveSessionStatus 依目前牆鐘時間比較,見上方模組註解)。
const LIVE_SESSION: ApiTodaySession = { id: 's-live', course_id: 'c-live', course_name: '測試進行中班', coach_name: '測試教練甲', start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 5, venue: '測試教室' };
const WAIT_SESSION: ApiTodaySession = { id: 's-wait', course_id: 'c-wait', course_name: '測試備課班', coach_name: '測試教練乙', start_time: '23:59:58', end_time: '23:59:59', enrolled_count: 3, venue: '測試教室2' };

const ACTIVITY_ITEMS = [
	{ kind: 'user' as const, label: '測試動態一', occurred_at: '2026-01-01T00:00:00Z' },
	{ kind: 'order' as const, label: '測試動態二', occurred_at: '2026-01-01T00:00:00Z' }
];

// enrolledValue/revenueMonthValue 刻意與 seed 相異，證明頁面讀 payload（真
// GET /reports/admin），不是殘留的舊硬編字面(248 / NT$182K)。members.active=999、
// revenue.this_month_cents=99900000(ntd 後 999,000)。
const WIRE_REPORTS = {
	revenue: { this_month_cents: 99900000, last_month_cents: 0, trend: [] },
	kpis: {
		new_members: { this_month: 0, last_month: 0 },
		new_enrolments: { this_month: 0, last_month: 0 },
		paid_orders_count: { this_month: 0, last_month: 0 },
		attendance_rate: { this_month: null, last_month: null }
	},
	revenue_breakdown: [],
	income_sources_12m: [],
	category_split: [],
	payment_split: [],
	attendance_distribution: [],
	age_distribution: [],
	tier_distribution: [],
	retention: [],
	funnel: { trial_inquiries: 0, new_enrolments: 0 },
	weekday_load: [],
	venue_usage: [],
	members: { total: 999, new_this_month: 0, active: 999 },
	courses: [],
	coaches: []
};

const homeRoutes = (sessions: ApiTodaySession[], items: typeof ACTIVITY_ITEMS) => ({
	'GET /reports/admin': WIRE_REPORTS,
	'GET /sessions/today': sessions,
	'GET /reports/admin/activity': { items }
});

/** getOpsCollections 回傳(新增學員走 store 的 addMember,寫入成功後會重抓 ops 集合)。
 *  只需要 GET /users?page=1 隨 memberRows 變化，其餘三路沿用 OPS_ROUTES 預設值。 */
const opsWith = (memberRows: typeof MEMBERS) => ({
	...OPS_ROUTES,
	'GET /users?page=1': { users: memberRows.map((m) => ({ id: m.id, name: m.name, phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: m.points })), total: memberRows.length, page: 1, per_page: 20 }
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(
		fakeRouter({ ...homeRoutes([LIVE_SESSION, WAIT_SESSION], ACTIVITY_ITEMS), ...opsWith(MEMBERS) })
	);
	members.set(MEMBERS);
	resetOpsForTests();
	overlay.closeAll();
});

describe('mobile-admin/admin 頁(總覽首頁)', () => {
	function callCount(method: string, path: string): number {
		return vi.mocked(api).mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method).length;
	}
	const wireMember = (over: Partial<{ id: string; name: string }>) => ({
		id: 'zz-quick', name: '新學員', phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: 0, ...over
	});

	it('loading 分支顯示骨架(data-testid="madmin-home-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(AdminHomePage);
		expect(container.querySelector('[data-testid="madmin-home-skeleton"]')).not.toBeNull();
	});

	it('Hero KPI(在學學員/本月營收)讀 payload(真 GET /reports/admin，相異 fixture)', async () => {
		const { findByText, container } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText('999')).toBeInTheDocument();
		expect(await findByText('NT$999,000')).toBeInTheDocument();
		const txt = container.textContent ?? '';
		// 已移除的兩張 KPI 卡(本週課堂/出席偏低)與硬編日期字面不應殘留。
		expect(txt).not.toContain('本週課堂');
		expect(txt).not.toContain('出席偏低');
		expect(txt).not.toContain('2026 年 6 月 10 日');
	});

	it('opsHydrated 未落地時，待付款橫幅不出現，即使 $orders 仍是同步 seed(有 pending 訂單)', async () => {
		// 四路 ops 端點故意 pending 不 resolve，模擬 hydrateOps() 還在飛行中——orders
		// store 的同步 seed 本身就有 pending 訂單，舊碼不呼叫 hydrateOps()、直接讀
		// $orders，會在真正水合前就顯示一個假的「N 筆訂單待付款」橫幅。
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...homeRoutes([LIVE_SESSION, WAIT_SESSION], ACTIVITY_ITEMS),
				'GET /users?page=1': () => new Promise(() => {}),
				'GET /courses?page=1': () => new Promise(() => {}),
				'GET /coaches': () => new Promise(() => {}),
				'GET /orders?page=1': () => new Promise(() => {})
			})
		);
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('測試動態一'); // 等 getAdminHome 的 ready(與 ops 水合是獨立的兩支請求)
		expect(queryByText('筆訂單', { exact: false })).toBeNull();
	});

	it('opsHydrated 落地後，待付款橫幅依 $orders 的 pending 數顯示', async () => {
		const { findByText } = render(AdminHomePage);
		await findByText('測試動態一');
		expect(await findByText('筆訂單', { exact: false })).toBeInTheDocument(); // onMount 的 hydrateOps() 落地後才出現
	});

	it('render 今日課表與進行中課堂橫幅(皆讀 payload 的 today)', async () => {
		const { findAllByText, findByText } = render(AdminHomePage);
		// 進行中的班級同時出現在「進行中課堂」橫幅與「今日課表」清單——但班名本身在
		// 「今日課表」清單一律會出現(不論是否 live)，只斷言班名出現無法證明橫幅真的
		// 渲染了；改斷言橫幅自己的靜態標題文字「● 進行中課堂」(只在 {#if liveNow} 為
		// true 時才會出現)，這才是可證偽的橫幅渲染檢查。
		expect((await findAllByText('測試進行中班')).length).toBeGreaterThan(0);
		expect(await findByText('● 進行中課堂')).toBeInTheDocument();
		expect(await findByText('測試備課班')).toBeInTheDocument();
	});

	/* C5 回歸(pin-first)：liveNow 原本比對 payload 自帶的獨立 label 欄位——wire 邊界
	 * 已無「label」可餵(tone/label 一律由 SESSION_STATUS 查表依 state 推導,見上方模組
	 * 註解),「label 與 state 脫鉤」這個矛盾輸入在 wire 層構造不出來，故以下兩則改為
	 * 直接驗證：橫幅只認 state(由極端 start_time/end_time 推導)，不是任何呼叫端可
	 * 另外指定的欄位——回歸精神不變，構造方式改走 wire。 */
	it('state 推導為 live 的課堂 → 進行中課堂橫幅出現', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...homeRoutes([LIVE_SESSION], ACTIVITY_ITEMS), ...opsWith(MEMBERS) }));
		const { findByText } = render(AdminHomePage);
		expect(await findByText('● 進行中課堂')).toBeInTheDocument();
	});

	it('state 推導為 wait 的課堂 → 進行中課堂橫幅不出現', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...homeRoutes([WAIT_SESSION], ACTIVITY_ITEMS), ...opsWith(MEMBERS) }));
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('測試備課班');
		expect(queryByText('● 進行中課堂')).toBeNull();
	});

	it('render 最新動態(讀 payload 的 activity)', async () => {
		const { findByText } = render(AdminHomePage);
		expect(await findByText('測試動態一')).toBeInTheDocument();
		expect(await findByText('測試動態二')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...homeRoutes([LIVE_SESSION, WAIT_SESSION], ACTIVITY_ITEMS), ...opsWith(MEMBERS), 'GET /reports/admin': new Error('boom') })
		);
		const { findByText } = render(AdminHomePage);
		expect(await findByText('載入失敗')).toBeInTheDocument();
	});

	it('today/activity 空集合不當機,且沒有進行中課堂橫幅', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...homeRoutes([], []), ...opsWith(MEMBERS) }));
		const { findByText, queryByText } = render(AdminHomePage);
		await findByText('營運總覽');
		expect(queryByText('進行中課堂')).toBeNull();
	});

	/* Task 20 — 快速操作「新增學員」改開真表單並接 createMember，不再是本地假寫入。 */
	it('快速操作「新增學員」開出的 sheet 帶入真正呼叫 createMember 的 onSave', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...homeRoutes([LIVE_SESSION, WAIT_SESSION], ACTIVITY_ITEMS), ...opsWith(MEMBERS), 'POST /users': wireMember({}) })
		);
		const { findByText } = render(AdminHomePage);
		await findByText('新增學員');

		await fireEvent.click(await findByText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (body: CreateMemberBody) => Promise<void> };
		expect(sheetProps).toBeTruthy();

		const body: CreateMemberBody = { email: 'a@test.com', name: '新學員', password: 'password123' };
		await sheetProps.onSave(body);

		expect(api).toHaveBeenCalledWith('/users', { method: 'POST', body: JSON.stringify(body) });
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});

	/* R12 Task 3 回歸:快速新增學員原本只打 createMember、不重抓——$members 維持舊清單,
	 * 使用者轉到學員管理頁看不到剛建的學員(hydrateOps 已水合則被 guard 短路)。改走
	 * store 的 addMember() 後,寫入成功即 await refreshOps()。 */
	it('快速新增學員後重抓 ops 集合($members 含新學員),並顯示成功 toast', async () => {
		const created = { ...MEMBERS[0], id: 'zz-quick', name: '快速新增的學員' };
		await hydrateOps(); // 已水合(fetch 替身回舊清單):舊碼下 hydrateOps 會被 guard 短路,列表永遠看不到新學員
		const usersCallsBefore = callCount('GET', '/users?page=1');
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...homeRoutes([LIVE_SESSION, WAIT_SESSION], ACTIVITY_ITEMS),
				...opsWith([...MEMBERS, created]),
				'POST /users': wireMember({ name: '快速新增的學員' })
			})
		);
		const { findByText } = render(AdminHomePage);
		await fireEvent.click(await findByText('新增學員'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (body: CreateMemberBody) => Promise<void> };

		await sheetProps.onSave({ email: 'q@test.com', name: '快速新增的學員', password: 'password123' });

		expect(callCount('GET', '/users?page=1')).toBeGreaterThan(usersCallsBefore); // 寫入成功後真的 refreshOps()
		expect(get(members).some((m) => m.id === 'zz-quick')).toBe(true);
		expect(get(toasts).some((t) => t.title === '已新增學員')).toBe(true);
	});
});
