import { describe, it, expect, vi, beforeEach } from 'vitest';

/* R15 Task 3a(候選 轉手退役)：mobile-admin/api.ts 這些組合器(getMore/getCoachHome/
 * getAdminHome/getOpsCollections/getMessages，3b 留任)本身是「轉呼叫桌面 admin/coach
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
 * 這裡刪除不留驗證缺口)。本檔現在只驗證真正留任的 5 支組合器。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES, USERS_FIXTURE, COURSES_FIXTURE, COACHES_FIXTURE, ORDERS_FIXTURE } from '$lib/testing/ops-routes';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { ApiCoach, ApiVenue, ApiProduct } from '$lib/public/api';
import type { TodaySessionResponse } from '$lib/api/wire';
import { initialOf, isoDate, orderIdentity, taxFromGross } from '$lib/api/wire';
import { ntd, orderItemsSummary } from '$lib/public/adapters';
import { mapMemberAccount, MEMBER_COLORS } from '$lib/admin/data';
import { mapCourse } from '$lib/admin/api';
import { getMore, getCoachHome, getAdminHome, getOpsCollections, getMessages } from './api';
import { PROFILES } from './data';

/* Task 3 修正回合 1(Important)：getMore/getOpsCollections 原本只斷言 .length > 0，
 * 會漏抓集合互換(例如 classes↔coaches)這類 wiring bug。這裡鏡射 admin/api.ts 私有的
 * mapCoach()/mapVenue()/mapProduct()/mapAdminOrder()(皆未 export，同
 * CoachesScreen.test.ts 的 expectedFromWire() precedent)，把每個 wire fixture 經
 * 「真實映射邏輯」算出精確期望值，斷言改回 toEqual(逐欄位，含 pages)。mapCourse()
 * 本身有 export，直接沿用(同 admin/classes/page.test.ts 的 FIXTURE_CLASSES 慣例)。 */
function expectedCoach(c: ApiCoach, i: number) {
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
function expectedVenue(v: ApiVenue) {
	return {
		id: v.id,
		slug: v.slug,
		name: v.name,
		type: v.description ?? '',
		equip: v.features,
		status: v.is_active ? 'available' : 'maintenance'
	};
}
function expectedTicket(p: ApiProduct, i: number) {
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
function expectedOrder(o: (typeof ORDERS_FIXTURE)[number], i: number) {
	const amount = ntd(o.total_cents);
	const { tax, net } = taxFromGross(amount);
	const { display, uuid } = orderIdentity(o);
	return {
		id: display,
		orderId: uuid,
		member: o.user_name,
		initial: initialOf(o.user_name),
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		item: orderItemsSummary(o.items, `訂單 ${o.order_number}`),
		amount,
		status: o.status,
		method: '線上',
		date: isoDate(o.created_at),
		discount: o.coupon_code ?? '',
		tax,
		net,
		paidAt: '—（待付款）' // ORDERS_FIXTURE 唯一一筆是 pending、paid_at null
	};
}

const ME: TestUser = { id: 'u-c1', email: 'c1@test.com', name: '測試教練', phone: null, last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: ApiCoach = { id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' };

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
		const coaches: ApiCoach[] = [MY_COACH];
		const venues: ApiVenue[] = [{ id: 'v1', category_id: null, slug: 'v1', name: '測試場地', description: null, features: [], image_url: null, is_active: true, created_at: '' }];
		const products: ApiProduct[] = [{ id: 't1', name: '測試票券', slug: 't1', product_type: 'ticket', description: null, price_cents: 1000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: null, quota: null, sold: 0, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' }];
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
		'GET /reports/coach': { today_sessions: 1, pending_attendance: 2, unread_messages: 3, student_count: 5, attendance_rate_30d: 0.9 },
		'GET /conversations/me': []
	});

	it('resolves the real coach identity + today schedule + KPI counts from getDashboard()', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(routes()));

		const d = await getCoachHome();

		expect(d.coach.name).toBe(ME.name);
		expect(d.coachToday).toEqual([{ time: '00:00', name: '測試班', room: 'A', count: 5, state: 'live', tone: 'success', label: '上課中' }]);
		expect(d.pendingClasses).toBe('2 班');
		expect(d.pendingReplies).toBe('3 則');
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

describe('getOpsCollections', () => {
	it('resolves members/classes/coaches/orders + 分頁 meta from the real admin seams (page 1, parallel)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(OPS_ROUTES));

		const d = await getOpsCollections();

		// coaches 取自 GET /courses?page=1 回應裡的 coaches(getClasses 內部組出)——
		// GET /coaches 只在這裡沒被叫過(呼叫次數斷言留給 admin/api.test.ts)，故 coaches
		// 期望值鏡射 COACHES_FIXTURE(getClasses() 內平行拉的 listCoaches() 回應)而非
		// 另一份 GET /coaches fixture。
		const expectedCoaches = COACHES_FIXTURE.map(expectedCoach);
		const coachNameById = new Map(expectedCoaches.map((c) => [c.id, c.name]));

		expect(d).toEqual({
			members: USERS_FIXTURE.map(mapMemberAccount),
			classes: COURSES_FIXTURE.map((c) => mapCourse(c, coachNameById)),
			coaches: expectedCoaches,
			orders: ORDERS_FIXTURE.map(expectedOrder),
			pages: {
				members: { total: USERS_FIXTURE.length, perPage: 100 },
				classes: { total: COURSES_FIXTURE.length, perPage: 100 },
				orders: { total: ORDERS_FIXTURE.length, perPage: 100 }
			}
		});
	});
});

describe('getMessages', () => {
	it('maps real conversations (GET /conversations/me) to the mobile message-list shape', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /conversations/me': [
					{ id: 'c1', peer_id: 'p1', peer_name: '王媽媽', last_message_body: '哈囉', last_message_at: '2026-07-10T09:10:00Z', unread_count: 2 },
					{ id: 'c2', peer_id: 'p2', peer_name: '陳爸爸', last_message_body: '謝謝', last_message_at: null, unread_count: 0 }
				]
			})
		);

		const rows = await getMessages();

		expect(rows).toEqual([
			{ id: 'c1', from: '王媽媽', initial: '王', color: '#0066CC', preview: '哈囉', time: '2026-07-10 09:10', unread: true },
			{ id: 'c2', from: '陳爸爸', initial: '陳', color: '#0066CC', preview: '謝謝', time: '', unread: false }
		]);
	});
});
