import { describe, it, expect, vi, beforeEach } from 'vitest';

/* R15 Task 3a(候選 轉手退役)：mobile-admin/api.ts 這些組合器(getMore/getCoachHome/
 * getAdminHome，3b 留任)本身是「轉呼叫桌面 admin/coach
 * seam 真實作」的薄層——舊版在這裡把 $lib/admin/api、$lib/coach/api 整包 mock 掉，只驗證
 * 「呼叫到正確的桌面函式、回傳值有正確映射」，桌面函式本身是否真的打對 API 完全不在
 * 這層測試範圍內(該職責在 admin/api.test.ts、coach/api.test.ts)。改 mock 最底層
 * $lib/api/client 的 api()，讓桌面 seam 也是真實作、真的跑到 fetch adapter，這裡就是
 * 端對端(wire → 組合器輸出)的薄層驗證，不再是兩層 mock 疊起來的「mock 呼叫 mock」。
 *
 * R15 Task 3b(候選 轉手退役)：原本這裡還有 9 支「零映射 re-export」委派釘(getAttendance/
 * saveAttendance/getStudents/getCsettings/createConversation/getSettings/putSettings/
 * getVenues/getTickets)——這批只驗證「mobile-admin/api.ts 有把呼叫轉手給桌面 seam」，
 * 隨對應 re-export 一併從 mobile-admin/api.ts 刪除而整批退役(production 消費端已直接
 * import 擁有者模組；桌面 seam 本身的行為由 admin/api.test.ts、coach/api.test.ts 覆蓋，
 * 這裡刪除不留驗證缺口)。本檔現在只驗證真正留任的組合器。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { CoachResponse, VenueResponse, ProductResponse } from '$lib/api/generated';
import type { TodaySessionResponse } from '$lib/api/wire';
import { initialOf } from '$lib/api/wire';
import { ntd } from '$lib/public/adapters';
import { MEMBER_COLORS } from '$lib/admin/data';
import { getMore, getCoachHome, getAdminHome } from './api';
import { PROFILES } from './data';

/* Task 3 修正回合 1(Important)：getMore 原本只斷言 .length > 0，
 * 會漏抓集合互換(例如 classes↔coaches)這類 wiring bug。這裡鏡射 admin/api.ts 私有的
 * mapCoach()/mapVenue()/mapProduct()(皆未 export，同
 * CoachesScreen.test.ts 的 expectedFromWire() precedent)，把每個 wire fixture 經
 * 「真實映射邏輯」算出精確期望值，斷言改回 toEqual(逐欄位)。 */
function expectedCoach(c: CoachResponse, i: number) {
	return {
		id: c.id,
		userId: c.user_id,
		name: c.name,
		initial: initialOf(c.name),
		title: c.title,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		tags: c.specialties,
		isActive: c.is_active
	};
}
function expectedVenue(v: VenueResponse) {
	return {
		id: v.id,
		slug: v.slug,
		name: v.name,
		type: v.description ?? '',
		equip: v.features,
		status: v.is_active ? 'available' : 'maintenance'
	};
}
function expectedTicket(p: ProductResponse, i: number) {
	return {
		id: p.id,
		name: p.name,
		type: p.product_type,
		price: ntd(p.price_cents),
		sold: p.sold,
		quota: p.quota,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		icon: 'ticket',
		desc: p.description ?? ''
	};
}
const ME: TestUser = { id: 'u-c1', email: 'c1@test.com', name: '測試教練', phone: null, last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: CoachResponse = { id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' };

// 每個測試先登出再登入(同 coach/page.test.ts 慣例)：避免同一個 ME 連續 loginAs 不觸發
// identity 變更、教練身分閘門快取跨測試殘留。只有 getCoachHome 實際會經過
// requireCoach()，其餘測試多做這一步無害。
beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/logout': undefined }));
	await authStore.logout();
	await loginAs(ME);
	vi.mocked(api).mockClear();
});

describe('getMore', () => {
	it('resolves coaches/venues/tickets from the real admin seam (parallel), profiles stays mock', async () => {
		const coaches: CoachResponse[] = [MY_COACH];
		const venues: VenueResponse[] = [{ id: 'v1', category_id: null, slug: 'v1', name: '測試場地', description: null, features: [], image_url: null, is_active: true, created_at: '' }];
		const products: ProductResponse[] = [{ id: 't1', name: '測試票券', slug: 't1', product_type: 'ticket', description: null, price_cents: 1000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: null, quota: null, sold: 0, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' }];
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /coaches': coaches, 'GET /venues': venues, 'GET /products?page=1': { products, total: 1, page: 1, per_page: 20 } })
		);

		const d = await getMore();

		expect(d).toEqual({
			profiles: PROFILES,
			coaches: coaches.map(expectedCoach),
			venues: venues.map(expectedVenue),
			tickets: products.map(expectedTicket)
		});
	});
});

describe('getCoachHome', () => {
	const SESSION = { id: 's1', course_id: 'c1', course_name: '測試班', coach_name: ME.name, start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 5, venue: 'A', status: 'ongoing' } satisfies TodaySessionResponse;
	const routes = () => ({
		'GET /users/me': ME,
		'GET /coaches': [MY_COACH],
		'GET /sessions/today': [SESSION],
		'GET /reports/coach': { today_sessions: 1, pending_attendance: 2, unread_messages: 3, student_count: 5, attendance_rate_30d: 0.9 }
	});

	it('resolves the real coach identity + today schedule + KPI counts from getDashboard()', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(routes()));

		const d = await getCoachHome();

		expect(d.coach.name).toBe(ME.name);
		expect(d.coachToday).toEqual([{ id: 's1', start: '00:00', end: '23:59', name: '測試班', room: 'A', count: 5, status: 'live' }]);
		expect(d.pendingClasses).toBe('2 班');
		expect(d.pendingReplies).toBe('3 則');
	});

	it('不打 GET /conversations/me(getDashboard 不再抓對話,教練首頁沒有重複的 GET)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(routes()));

		await getCoachHome();

		expect(vi.mocked(api).mock.calls.map(([path]) => path)).not.toContain('/conversations/me');
	});

	it('propagates CoachNotFoundError so the page can show 此帳號未綁定教練檔案', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [] }));
		await expect(getCoachHome()).rejects.toThrow('此帳號未綁定教練檔案');
	});
});

describe('getAdminHome', () => {
	const WIRE_REPORTS = {
		revenue: { this_month_cents: 18200000, last_month_cents: 0, trend: [] },
		kpis: {
			new_members: { this_month: 0, last_month: 0 }, new_enrolments: { this_month: 0, last_month: 0 },
			paid_orders_count: { this_month: 0, last_month: 0 }, attendance_rate: { this_month: null, last_month: null }
		},
		revenue_breakdown: [], income_sources_12m: [], category_split: [], payment_split: [],
		attendance_distribution: [], age_distribution: [], tier_distribution: [], retention: [],
		funnel: { trial_inquiries: 0, new_enrolments: 0 }, weekday_load: [], venue_usage: [],
		members: { total: 300, new_this_month: 5, active: 248 }, courses: [], coaches: []
	};

	it('resolves the two real KPIs from getReports(), and real today/activity from getTodaySessions()/getRecentActivity() (Task F11), drops the removed KPIs', async () => {
		const SESSION = { id: 's1', course_id: 'c1', course_name: '兒童基礎 B 班', coach_name: '陳冠宇', start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 8, venue: 'B 教室', status: 'ongoing' } satisfies TodaySessionResponse;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /reports/admin': WIRE_REPORTS,
				'GET /sessions/today': [SESSION],
				'GET /reports/admin/activity': { items: [{ kind: 'user', label: '新會員註冊:謝佩珊', occurred_at: '2026-07-10T09:12:00Z' }] }
			})
		);

		const d = await getAdminHome();

		expect(d.profiles).toEqual(PROFILES);
		expect(d.today).toEqual([{ time: '00:00', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, state: 'live', tone: 'success', label: '上課中' }]);
		expect(d.activity).toEqual([{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新會員註冊:謝佩珊', time: '2026-07-10 09:12' }]);
		expect(d.enrolledValue).toBe('248');
		expect(d.revenueMonthValue).toBe('NT$182,000');
	});

	it('propagates a null-mapped(「—」) coach/venue straight through from getTodaySessions() (already substituted upstream)', async () => {
		const SESSION = { id: 's2', course_id: 'c2', course_name: '跑酷體驗班', coach_name: null, start_time: '23:59:58', end_time: '23:59:59', enrolled_count: 3, venue: null, status: 'upcoming' } satisfies TodaySessionResponse;
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /reports/admin': WIRE_REPORTS, 'GET /sessions/today': [SESSION], 'GET /reports/admin/activity': { items: [] } })
		);

		const d = await getAdminHome();

		expect(d.today).toEqual([{ time: '23:59', name: '跑酷體驗班', coach: '—', room: '—', count: 3, state: 'wait', tone: 'neutral', label: '尚未開始' }]);
	});
});
