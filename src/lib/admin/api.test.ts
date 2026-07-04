/* Dream Fly — admin/api.ts 單測(Task 18：venues/tickets/orders/classes/coaches 換真
 * API；members 新增 getMembers() seam；getReports 仍為 mock)。
 *
 * 只 mock $lib/api/client 的 api() —— listCourses/listCoaches/listVenues/listProducts
 * (Task 14 public seam) 一律用真實實作，這樣才是「後端形狀進、UI 形狀出」的端對端
 * 斷言，而不是把邏輯也一起 mock 掉(同 member/api.test.ts 的作法)。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getVenues,
	getTickets,
	getOrders,
	getReports,
	getClasses,
	getCoaches,
	getMembers,
	createCourse,
	updateCourse
} from './api';
import { api } from '$lib/api/client';
import { mapMemberAccount } from './data';
import {
	ORDER_STATUS,
	REPORT_KPIS,
	REVENUE_BREAKDOWN,
	REVENUE_TOTAL,
	REVENUE_TREND,
	CATEGORY_SPLIT,
	TOP_COURSES,
	INCOME_SOURCES,
	COACH_PERF,
	VENUE_USAGE,
	ATT_DIST,
	RETENTION,
	AGE_DIST,
	TIER_DIST,
	CAMPUS_REVENUE,
	PAYMENT_SPLIT,
	FUNNEL,
	WEEKDAY_LOAD
} from './data';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；未交代的端點一律丟錯，讓漏掉
 *  某支 mock 的測試直接失敗而不是悄悄回傳 undefined(同 member/api.test.ts)。 */
function fakeRouter(overrides: Record<string, unknown>) {
	return vi.fn(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		const key = `${method} ${path}`;
		if (key in overrides) {
			const value = overrides[key];
			if (value instanceof Error) throw value;
			return value;
		}
		throw new Error(`unexpected api call: ${key}`);
	});
}

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('getVenues — GET /venues（公開端點）', () => {
	it('映射 features→equip、is_active→status；type/area/cap/today 無對應欄位給誠實預設值', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /venues': [
					{
						id: 'v1',
						category_id: null,
						name: 'A 訓練館',
						slug: 'a',
						description: '競技主訓練場',
						features: ['彈翻床', '平衡木'],
						image_url: null,
						is_active: true,
						created_at: '2026-01-01T00:00:00Z'
					},
					{
						id: 'v2',
						category_id: null,
						name: '戶外場',
						slug: 'outdoor',
						description: null,
						features: [],
						image_url: null,
						is_active: false,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			})
		);

		const d = await getVenues();

		expect(api).toHaveBeenCalledWith('/venues', { auth: false });
		expect(d.venues).toEqual([
			{ id: 'v1', name: 'A 訓練館', type: '競技主訓練場', area: '', cap: 0, equip: ['彈翻床', '平衡木'], status: 'available', today: 0 },
			{ id: 'v2', name: '戶外場', type: '', area: '', cap: 0, equip: [], status: 'maintenance', today: 0 }
		]);
	});
});

describe('getTickets — GET /products（公開端點）', () => {
	it('ntd 轉換價格；sold/quota 直接來自後端；merchandise 濾除；product_type 對照 pass/event', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /products?per_page=100': {
					products: [
						{
							id: 'p1', name: '月票', slug: 'month', product_type: 'membership', description: '不限堂數',
							price_cents: 280000, original_price_cents: null, features: [], is_highlighted: false,
							badge: null, stock: null, quota: null, sold: 45, valid_days: 30, session_count: null, is_active: true,
							created_at: '', updated_at: ''
						},
						{
							id: 'p2', name: '10 堂回數票', slug: 'pack10', product_type: 'course_package', description: null,
							price_cents: 540000, original_price_cents: null, features: [], is_highlighted: false,
							badge: null, stock: 100, quota: 100, sold: 12, valid_days: null, session_count: 10, is_active: true,
							created_at: '', updated_at: ''
						},
						{
							id: 'p3', name: '比賽觀賽票', slug: 'watch', product_type: 'ticket', description: null,
							price_cents: 35000, original_price_cents: null, features: [], is_highlighted: false,
							badge: null, stock: null, quota: null, sold: 200, valid_days: null, session_count: null, is_active: true,
							created_at: '', updated_at: ''
						},
						{
							id: 'p4', name: '護具組', slug: 'gear', product_type: 'merchandise', description: null,
							price_cents: 100000, original_price_cents: null, features: [], is_highlighted: false,
							badge: null, stock: 20, quota: 20, sold: 3, valid_days: null, session_count: null, is_active: true,
							created_at: '', updated_at: ''
						}
					],
					total: 4,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getTickets();

		expect(api).toHaveBeenCalledWith('/products?per_page=100', { auth: false });
		expect(d.tickets).toHaveLength(3); // merchandise 濾除
		expect(d.tickets.find((t) => t.id === 'p1')).toMatchObject({ type: 'pass', price: 2800, sold: 45, quota: null });
		expect(d.tickets.find((t) => t.id === 'p2')).toMatchObject({ type: 'pass', price: 5400, sold: 12, quota: 100 });
		expect(d.tickets.find((t) => t.id === 'p3')).toMatchObject({ type: 'event', price: 350, sold: 200, quota: null });
		expect(d.tickets.find((t) => t.id === 'p4')).toBeUndefined();
	});
});

describe('getOrders — GET /orders（admin）', () => {
	const base = {
		user_email: 'a@b.com', points_used: 0, coupon_code: null as string | null, created_at: '2026-06-08T14:22:00Z',
		items: [{ name: '競技體操 選手班', quantity: 1 }]
	};

	it('映射 id/member/initial/amount/method/date/discount，涵蓋全部 6 種 status', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?per_page=100': {
					orders: [
						{ id: '1', order_number: 'DF-1', user_name: '王小明', status: 'pending', total_cents: 480000, ...base },
						{ id: '2', order_number: 'DF-2', user_name: '陳小華', status: 'paid', total_cents: 480000, ...base },
						{ id: '3', order_number: 'DF-3', user_name: '林小美', status: 'processing', total_cents: 480000, ...base },
						{ id: '4', order_number: 'DF-4', user_name: '張小強', status: 'completed', total_cents: 480000, ...base },
						{ id: '5', order_number: 'DF-5', user_name: '李小芳', status: 'cancelled', total_cents: 480000, ...base },
						{ id: '6', order_number: 'DF-6', user_name: '吳小龍', status: 'refunded', total_cents: 480000, ...base, coupon_code: 'SPRING10' }
					],
					total: 6,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getOrders();

		expect(api).toHaveBeenCalledWith('/orders?per_page=100');
		expect(d.orders).toHaveLength(6);
		expect(d.orders.map((o) => o.status)).toEqual(['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded']);

		const first = d.orders[0];
		expect(first.id).toBe('DF-1');
		expect(first.member).toBe('王小明');
		expect(first.initial).toBe('王');
		expect(first.amount).toBe(4800); // ntd(480000)
		expect(first.method).toBe('線上');
		expect(first.date).toBe('2026-06-08');
		expect(first.discount).toBe(''); // coupon_code ?? ''
		expect(first.paidAt).toBe('—（待付款）'); // pending → placeholder

		expect(d.orders[1].paidAt).toBe('2026-06-08'); // paid → real date
		expect(d.orders[5].discount).toBe('SPRING10');
	});

	it('由 amount 反推 5% 內含稅：net + tax === amount', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?per_page=100': {
					orders: [{ id: '1', order_number: 'DF-1', user_name: '王小明', status: 'paid', total_cents: 480000, ...base }],
					total: 1,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getOrders();

		const o = d.orders[0];
		expect(o.net + o.tax).toBe(o.amount);
	});

	it('item 摘要依 items 數量組成：0 項 fallback 訂單編號、1 項用該項名稱、N>1 項用「第一項 外 N-1 項」', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?per_page=100': {
					orders: [
						{ id: '1', order_number: 'DF-1', user_name: '王小明', status: 'paid', total_cents: 100000, ...base, items: [] },
						{ id: '2', order_number: 'DF-2', user_name: '王小明', status: 'paid', total_cents: 100000, ...base, items: [{ name: '體操基礎班', quantity: 1 }] },
						{
							id: '3', order_number: 'DF-3', user_name: '王小明', status: 'paid', total_cents: 100000, ...base,
							items: [
								{ name: '體操基礎班', quantity: 1 },
								{ name: '護具組', quantity: 2 },
								{ name: '月票 · 自由練習', quantity: 1 }
							]
						}
					],
					total: 3,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getOrders();

		expect(d.orders[0].item).toBe('訂單 DF-1'); // 0 項 → fallback
		expect(d.orders[1].item).toBe('體操基礎班'); // 1 項 → 該項名稱
		expect(d.orders[2].item).toBe('體操基礎班 外 2 項'); // 3 項 → 第一項 外 2 項
	});
});

describe('ORDER_STATUS — 中文對照涵蓋全部 6 態', () => {
	it('has all 6 statuses with the expected 中文 labels', () => {
		expect(ORDER_STATUS.pending[1]).toBe('待付款');
		expect(ORDER_STATUS.paid[1]).toBe('已付款');
		expect(ORDER_STATUS.processing[1]).toBe('處理中');
		expect(ORDER_STATUS.completed[1]).toBe('已完成');
		expect(ORDER_STATUS.cancelled[1]).toBe('已取消');
		expect(ORDER_STATUS.refunded[1]).toBe('已退款');
	});
});

describe('getClasses — GET /courses（+ GET /coaches 供教練對照/picker）', () => {
	it('enrolled/cap/wait 直接來自 enrolled_count/max_students/waitlist_count；price 經 ntd；schedule_text 拆分 day/time；coach_id 對照出教練姓名', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /courses?per_page=100': {
					courses: [
						{
							id: 'c1', name: '競技體操 選手班', slug: 'x', level: 'advanced', description: null,
							duration_minutes: 90, price_cents: 620000, max_students: 12, min_age: 8, max_age: 14,
							features: [], is_active: true, coach_id: 'co1', category: '競技體操',
							schedule_text: '週二、四 17:00-19:00', is_highlighted: false, created_at: '', updated_at: '',
							enrolled_count: 12, waitlist_count: 4
						},
						{
							id: 'c2', name: '兒童基礎 B 班', slug: 'y', level: 'beginner', description: null,
							duration_minutes: 60, price_cents: 320000, max_students: 10, min_age: 7, max_age: 9,
							features: [], is_active: true, coach_id: null, category: '兒童基礎', schedule_text: null,
							is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 7, waitlist_count: 0
						},
						{
							id: 'c3', name: '跑酷入門班', slug: 'z', level: 'intermediate', description: null,
							duration_minutes: 90, price_cents: 340000, max_students: 10, min_age: 12, max_age: null,
							features: [], is_active: true, coach_id: null, category: '跑酷', schedule_text: '週日 15:00-16:30',
							is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 8, waitlist_count: 2
						}
					],
					total: 3,
					page: 1,
					per_page: 100
				},
				'GET /coaches': [
					{
						id: 'co1', user_id: 'u1', name: '林教練', title: '資深體操教練', bio: null, experience: null,
						specialties: ['競技體操'], certifications: [], is_active: true, display_order: 1,
						slug: null, photo_url: null, created_at: ''
					}
				]
			})
		);

		const d = await getClasses();

		// listCourses/listCoaches(Task 14 public seam)內部都呼叫同一支 api()，兩者皆 auth:false(公開端點)
		expect(api).toHaveBeenCalledWith('/courses?per_page=100', { auth: false });
		expect(api).toHaveBeenCalledWith('/coaches', { auth: false });
		expect(d.classes).toHaveLength(3);
		expect(d.coaches).toEqual([
			expect.objectContaining({ id: 'co1', name: '林教練' })
		]);

		const c1 = d.classes.find((c) => c.id === 'c1')!;
		expect(c1.enrolled).toBe(12);
		expect(c1.cap).toBe(12);
		expect(c1.wait).toBe(4);
		expect(c1.price).toBe(6200);
		expect(c1.day).toBe('週二、四');
		expect(c1.time).toBe('17:00-19:00');
		expect(c1.status).toBe('額滿'); // enrolled >= cap
		expect(c1.coach).toBe('林教練'); // 經 coach_id 對照
		expect(c1.level).toBe('進階'); // advanced → 進階
		expect(c1.age).toBe('8–14 歲');

		const c2 = d.classes.find((c) => c.id === 'c2')!;
		expect(c2.day).toBe(''); // schedule_text: null 的 fallback
		expect(c2.time).toBe('');
		expect(c2.status).toBe('招生中'); // 7 < 10, wait=0
		expect(c2.coach).toBe(''); // 無 coach_id
		expect(c2.level).toBe('入門'); // beginner → 入門

		const c3 = d.classes.find((c) => c.id === 'c3')!;
		expect(c3.status).toBe('候補'); // 8 < 10 但 wait=2 > 0
		expect(c3.level).toBe('基礎'); // intermediate → 基礎
		expect(c3.age).toBe('12 歲以上'); // 只有 min_age
	});
});

describe('createCourse — POST /courses（admin，Task 8 piece 1）', () => {
	it('POSTs the given body as-is and returns the CourseResponse', async () => {
		const created = {
			id: 'c-new', name: '新班級', slug: 'new-class', level: 'advanced', description: null,
			duration_minutes: 90, price_cents: 480000, max_students: 12, min_age: 8, max_age: 14,
			features: [], is_active: true, coach_id: 'co1', category: '競技體操', schedule_text: '週二 17:00-19:00',
			is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 0, waitlist_count: 0
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /courses': created }));

		const body = {
			name: '新班級',
			level: 'advanced',
			category: '競技體操',
			price_cents: 480000,
			max_students: 12,
			duration_minutes: 90
		};
		const result = await createCourse(body);

		expect(api).toHaveBeenCalledWith('/courses', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 422/409) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /courses': new Error('conflict') }));
		await expect(createCourse({ name: 'x' })).rejects.toThrow('conflict');
	});
});

describe('updateCourse — PATCH /courses/{id}（admin，Task 8 piece 1）', () => {
	it('PATCHes /courses/{id} with the given (partial) body and returns the CourseResponse', async () => {
		const updated = {
			id: 'c1', name: '改名班級', slug: 'x', level: 'intermediate', description: null,
			duration_minutes: 60, price_cents: 320000, max_students: 10, min_age: null, max_age: null,
			features: [], is_active: true, coach_id: null, category: '兒童基礎', schedule_text: null,
			is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 3, waitlist_count: 0
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /courses/c1': updated }));

		const body = { name: '改名班級', price_cents: 320000 };
		const result = await updateCourse('c1', body);

		expect(api).toHaveBeenCalledWith('/courses/c1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual(updated);
	});
});

describe('getCoaches — GET /coaches（公開端點）', () => {
	it('name/initial 改用真 name 欄位（不再借用 title）；title 為職稱且不同字；phone/years/students/awards/classes/status 無對應欄位給誠實預設值', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /coaches': [
					{
						id: 'co1', user_id: 'u1', name: '林雅婷', title: '資深競技體操教練', bio: null, experience: '12年資深教練',
						specialties: ['競技體操', '競技啦啦隊'], certifications: ['國家級'], is_active: true,
						display_order: 1, slug: null, photo_url: null, created_at: ''
					}
				]
			})
		);

		const d = await getCoaches();

		expect(api).toHaveBeenCalledWith('/coaches', { auth: false });
		expect(d.coaches).toEqual([
			{
				id: 'co1',
				name: '林雅婷',
				initial: '林',
				title: '資深競技體操教練',
				color: expect.any(String),
				tags: ['競技體操', '競技啦啦隊'],
				years: 0,
				students: 0,
				awards: 0,
				classes: 0,
				status: 'offline',
				phone: ''
			}
		]);
	});
});

describe('getMembers — GET /users（admin）', () => {
	it('映射 id/name/initial/phone/joined/status/points（binding 欄位規格）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users?per_page=100': {
					users: [
						{ id: 'u1', name: '王小明', phone: '0912345678', created_at: '2026-01-15T00:00:00Z', is_active: true, points_balance: 1250 },
						{ id: 'u2', name: '陳小華', phone: null, created_at: '2026-02-01T00:00:00Z', is_active: false, points_balance: 0 }
					],
					total: 2,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getMembers();

		expect(api).toHaveBeenCalledWith('/users?per_page=100');
		expect(d.members).toEqual([
			{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250 },
			{ id: 'u2', name: '陳小華', initial: '陳', phone: '', joined: '2026-02-01', status: 'inactive', points: 0 }
		]);
	});
});

describe('mapMemberAccount（純函式）', () => {
	it('由姓名推導 initial；null phone 給空字串；is_active 轉 active/inactive', () => {
		expect(
			mapMemberAccount({ id: 'x', name: '測試員', phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: 10 })
		).toEqual({ id: 'x', name: '測試員', initial: '測', phone: '', joined: '2026-01-01', status: 'active', points: 10 });
	});
});

describe('getReports — 保留 mock（P2：無對應後端彙總端點）', () => {
	it('回傳整包報表資料，不打任何網路請求', async () => {
		const d = await getReports();

		expect(d).toEqual({
			kpis: REPORT_KPIS,
			revenueBreakdown: REVENUE_BREAKDOWN,
			revenueTotal: REVENUE_TOTAL,
			revenueTrend: REVENUE_TREND,
			categorySplit: CATEGORY_SPLIT,
			topCourses: TOP_COURSES,
			incomeSources: INCOME_SOURCES,
			coachPerf: COACH_PERF,
			venueUsage: VENUE_USAGE,
			attDist: ATT_DIST,
			retention: RETENTION,
			ageDist: AGE_DIST,
			tierDist: TIER_DIST,
			campusRevenue: CAMPUS_REVENUE,
			paymentSplit: PAYMENT_SPLIT,
			funnel: FUNNEL,
			weekdayLoad: WEEKDAY_LOAD
		});
		expect(api).not.toHaveBeenCalled();
	});
});
