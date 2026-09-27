import { describe, it, expect, vi, beforeEach } from 'vitest';

/* R15 Task 3a(候選 轉手退役)：mobile-admin/api.ts 這些組合器(getMore/getCoachHome/
 * getAdminHome/getOpsCollections/getMessages，3b 留任)本身是「轉呼叫桌面 admin/coach
 * seam 真實作」的薄層——舊版在這裡把 $lib/admin/api、$lib/coach/api 整包 mock 掉，只驗證
 * 「呼叫到正確的桌面函式、回傳值有正確映射」，桌面函式本身是否真的打對 API 完全不在
 * 這層測試範圍內(該職責在 admin/api.test.ts、coach/api.test.ts)。改 mock 最底層
 * $lib/api/client 的 api()，讓桌面 seam 也是真實作、真的跑到 fetch adapter，這裡就是
 * 端對端(wire → 組合器輸出)的薄層驗證，不再是兩層 mock 疊起來的「mock 呼叫 mock」。
 *
 * 其餘 9 支「零映射 re-export」委派釘(getAttendance/saveAttendance/getStudents/
 * getCsettings/createConversation/getSettings/putSettings/getVenues/getTickets)這批
 * 在 3b 會整批退役(該 9 支只是薄轉手，production 消費端屆時改直接 import 擁有者模組)——
 * 這裡先一併改走 fakeRouter 維持本檔案唯一一種 mock 機制，3b 再刪除。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';
import { loginAs, type TestUser } from '$lib/testing/coach-session';
import { authStore } from '$lib/stores/authStore';
import type { ApiCoach, ApiVenue, ApiProduct } from '$lib/public/api';
import type { ApiTodaySession } from '$lib/api/wire';
import {
	getMore,
	getCoachHome,
	getAttendance,
	saveAttendance,
	getStudents,
	getCsettings,
	getAdminHome,
	getOpsCollections,
	getMessages,
	createConversation,
	getSettings,
	putSettings,
	getVenues,
	getTickets
} from './api';
import { PROFILES } from './data';

const ME: TestUser = { id: 'u-c1', email: 'c1@test.com', name: '測試教練', phone: null, last_login: null, created_at: '2026-01-01T00:00:00Z' };
const MY_COACH: ApiCoach = { id: 'coach-1', user_id: 'u-c1', name: ME.name, title: '測試職稱', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' };

// 每個測試先登出再登入(同 coach/page.test.ts 慣例)：避免同一個 ME 連續 loginAs 不觸發
// identity 變更、教練身分閘門快取跨測試殘留。只有部分描述區塊(getCoachHome/
// getAttendance/getCsettings)實際會經過 requireCoach()，其餘測試多做這一步無害。
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

		expect(d.profiles).toEqual(PROFILES);
		expect(d.coaches).toHaveLength(1);
		expect(d.venues).toHaveLength(1);
		expect(d.tickets).toHaveLength(1);
	});
});

describe('getCoachHome', () => {
	const SESSION: ApiTodaySession = { id: 's1', course_id: 'c1', course_name: '測試班', coach_name: ME.name, start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 5, venue: 'A' };
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

describe('getAttendance / saveAttendance — 零映射 re-export（R10 雙生收斂：ADR 0014 §2，行動頁改接 $lib/coach/attendance-controller，mapAttRow/RosterEntry 映射層退役）', () => {
	const SESSION: ApiTodaySession = { id: 's1', course_id: 'c1', course_name: '競技啦啦隊 進階班', coach_name: null, start_time: '19:00:00', end_time: '20:30:00', enrolled_count: 1, venue: null };
	const ROSTER = [{ enrolment_id: 'en-1', user_id: 'u1', user_name: '王小明', attendance_status: 'present' as const }];

	it('getAttendance 直接委派給桌面 coach/api.ts 的 getAttendance verbatim', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH], 'GET /sessions/today': [SESSION], 'GET /sessions/s1/roster': ROSTER })
		);

		const { classes, failedClasses } = await getAttendance();

		expect(failedClasses).toEqual([]);
		expect(classes).toEqual([
			{
				id: 's1', name: '競技啦啦隊 進階班', time: '今日 19:00–20:30', start: '19:00', room: '—', coach: ME.name,
				roster: [{ n: '01', name: '王小明', initial: '王', color: '#0066CC', mid: 'en-1', def: 'present' }]
			}
		]);
	});

	it('saveAttendance 直接委派給桌面 coach/api.ts 的 saveAttendance，參數與回傳皆 verbatim', async () => {
		const updated = [{ enrolment_id: 'en-1', user_id: 'u1', user_name: '王小明', attendance_status: 'absent' as const }];
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /sessions/s1/attendance': updated }));

		const rows = await saveAttendance('s1', { 'en-1': 'absent' });

		expect(api).toHaveBeenCalledWith('/sessions/s1/attendance', { method: 'PUT', body: JSON.stringify({ records: [{ enrolment_id: 'en-1', status: 'absent' }] }) });
		expect(rows).toEqual([{ n: '01', name: '王小明', initial: '王', color: '#0066CC', mid: 'en-1', def: 'absent' }]);
	});
});

describe('getStudents', () => {
	it('delegates to the real coach roster seam (GET /coaches/me/students) verbatim', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /coaches/me/students': [{ user_id: 'u1', name: '王小明', phone: null, courses: [] }] })
		);
		const { students } = await getStudents();
		expect(students).toEqual([{ user_id: 'u1', name: '王小明', initial: '王', color: '#0066CC', cls: '', courses: [], level: '初階', skill: '', pct: 0, att: 0 }]);
	});
});

describe('getCsettings', () => {
	it('delegates to the real coach settings seam (GET /users/me + /coaches) verbatim', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH] }));
		const { coach } = await getCsettings();
		expect(coach.name).toBe(ME.name);
		expect(coach.role).toBe(MY_COACH.title);
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
		const SESSION: ApiTodaySession = { id: 's1', course_id: 'c1', course_name: '兒童基礎 B 班', coach_name: '陳冠宇', start_time: '00:00:00', end_time: '23:59:59', enrolled_count: 8, venue: 'B 教室' };
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
		const SESSION: ApiTodaySession = { id: 's2', course_id: 'c2', course_name: '跑酷體驗班', coach_name: null, start_time: '23:59:58', end_time: '23:59:59', enrolled_count: 3, venue: null };
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

		expect(d.members.length).toBeGreaterThan(0);
		expect(d.classes.length).toBeGreaterThan(0);
		expect(d.coaches.length).toBeGreaterThan(0);
		expect(d.orders.length).toBeGreaterThan(0);
		expect(d.pages.members.perPage).toBe(100);
		// coaches 取自 GET /courses?page=1 回應裡的 coaches(getClasses 內部組出)——
		// GET /coaches 只在這裡沒被叫過(呼叫次數斷言留給 admin/api.test.ts)。
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

describe('createConversation — 零映射 re-export（R14 候選 F5：POST /conversations，行動訊息對話串改接 $lib/coach/messages-controller，deps 需與桌面逐字相同）', () => {
	it('createConversation 直接委派給桌面 coach/api.ts 的 createConversation，參數與回傳皆 verbatim', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /conversations': { id: 'c1', last_message_at: null } }));

		const result = await createConversation('u1', '王小明');

		expect(api).toHaveBeenCalledWith('/conversations', { method: 'POST', body: JSON.stringify({ user_id: 'u1' }) });
		expect(result).toEqual({ id: 'c1', name: '王小明', initial: '王', color: '#0066CC', kind: '會員', time: '', badge: 0, preview: '尚無訊息' });
	});
});

describe('getSettings / putSettings — 零映射 re-export（Task F9：GET/PUT /settings，桌面/行動共用同一組欄位）', () => {
	const WIRE_SETTINGS = {
		settings: {
			studio_profile: { name: 'X', phone: '', address: '', default_ratio: '1:6', max_class_size: 12 },
			notification_flags: { email: true, sms: false, low_attendance_alert: true, auto_waitlist_promote: true },
			security: { two_factor_enabled: true }
		}
	};

	it('getSettings 直接委派給桌面 admin/api.ts 的 getSettings verbatim', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': WIRE_SETTINGS }));
		const d = await getSettings();
		expect(d.studioProfile.name).toBe('X');
		expect(d.security.twoFA).toBe(true);
	});

	it('putSettings 直接委派給桌面 admin/api.ts 的 putSettings，body 原樣傳遞 verbatim', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /settings': WIRE_SETTINGS }));
		const body = { security: { twoFA: false } };

		await putSettings(body);

		expect(api).toHaveBeenCalledWith('/settings', { method: 'PUT', body: JSON.stringify({ settings: body }) });
	});
});

describe('getVenues / getTickets — 薄委派 re-export（C4：GET /venues、GET /products，場館/票券 push screen 消費）', () => {
	it('getVenues 直接委派給桌面 admin/api.ts 的 getVenues verbatim', async () => {
		const venue: ApiVenue = { id: 'v1', category_id: null, slug: 'v-1', name: '場地甲', description: null, features: [], image_url: null, is_active: true, created_at: '' };
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /venues': [venue] }));
		const d = await getVenues();
		expect(d.venues).toHaveLength(1);
		expect(d.venues[0].name).toBe('場地甲');
	});

	it('getTickets 直接委派給桌面 admin/api.ts 的 getTickets，分頁參數原樣傳遞 verbatim', async () => {
		const product: ApiProduct = { id: 't1', name: '票券甲', slug: 't1', product_type: 'ticket', description: null, price_cents: 1000, original_price_cents: null, features: [], is_highlighted: false, badge: null, stock: null, quota: null, sold: 0, valid_days: null, session_count: null, is_active: true, created_at: '', updated_at: '' };
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /products?page=2': { products: [product], total: 1, page: 2, per_page: 20 } }));

		const d = await getTickets(2);

		expect(api).toHaveBeenCalledWith('/products?page=2');
		expect(d.tickets).toHaveLength(1);
		expect(d.tickets[0].name).toBe('票券甲');
	});
});
