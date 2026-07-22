/* Dream Fly — admin/api.ts 單測(Task 18：venues/tickets/orders/classes/coaches 換真
 * API；members 新增 getMembers() seam；getReports 型別/mapper/測試自 C5(第八輪架構
 * 深化，見 docs/adr/0018)起遷至 reports-api.ts/reports-api.test.ts，本檔不再涵蓋)。
 *
 * 只 mock $lib/api/client 的 api() —— listCourses/listCoaches/listVenues/listProducts
 * (Task 14 public seam) 一律用真實實作，這樣才是「後端形狀進、UI 形狀出」的端對端
 * 斷言，而不是把邏輯也一起 mock 掉(同 member/api.test.ts 的作法)。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getVenues,
	createVenue,
	updateVenue,
	getTickets,
	getOrders,
	getClasses,
	getCoaches,
	createCoach,
	updateCoach,
	getMembers,
	createCourse,
	updateCourse,
	createProduct,
	updateProduct,
	updateOrderStatus,
	getCoupons,
	createCoupon,
	updateCoupon,
	deleteCoupon,
	createMember,
	updateMember,
	getTodaySessions,
	getRecentActivity,
	getSettings,
	putSettings
} from './api';
import { api, ApiError } from '$lib/api/client';
import { deriveSessionStatus } from '$lib/domain/sessions';
import { mapMemberAccount } from './data';
import { ORDER_STATUS } from './data';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// deriveSessionStatus 預設沿用真實實作(其餘既有測試靠 vi.setSystemTime 驅動真實時間
// 比較邏輯)——只有下面「soon 分支」測試會用 mockReturnValueOnce 強制覆寫一次，驗證
// SESSION_STATUS 已補齊的第 4 值查表分支(Important #2(b) 終審修正；C4 起查表單源
// 收斂至 $lib/domain/sessions，mock 路徑同步改)。
vi.mock('$lib/domain/sessions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/domain/sessions')>();
	return { ...actual, deriveSessionStatus: vi.fn(actual.deriveSessionStatus) };
});

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('getVenues — GET /venues（公開端點）', () => {
	it('映射 slug 直接透傳、features→equip、is_active→status、description→type(借用)；area/cap/today 裝飾欄位已收斂移除(Task F4)', async () => {
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
			{ id: 'v1', slug: 'a', name: 'A 訓練館', type: '競技主訓練場', equip: ['彈翻床', '平衡木'], status: 'available' },
			{ id: 'v2', slug: 'outdoor', name: '戶外場', type: '', equip: [], status: 'maintenance' }
		]);
	});
});

describe('createVenue — POST /venues（admin，Task F4：場館寫入接線）', () => {
	it('POSTs the given body as-is and returns the VenueResponse', async () => {
		const created = {
			id: 'v-new', category_id: null, name: '新場地', slug: 'new-venue', description: '新場地說明',
			features: [], image_url: null, is_active: true, created_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /venues': created }));

		const body = { name: '新場地', description: '新場地說明', features: [], is_active: true };
		const result = await createVenue(body);

		expect(api).toHaveBeenCalledWith('/venues', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 409 slug 撞號) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /venues': new Error('slug conflict') }));
		await expect(createVenue({ name: 'x' })).rejects.toThrow('slug conflict');
	});
});

describe('updateVenue — PATCH /venues/{id}（admin，Task F4：場館寫入接線）', () => {
	it('PATCHes /venues/{id} with the given (partial) body and returns the VenueResponse', async () => {
		const updated = {
			id: 'v1', category_id: null, name: '改名場地', slug: 'a', description: '競技主訓練場',
			features: ['彈翻床'], image_url: null, is_active: true, created_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /venues/v1': updated }));

		const body = { name: '改名場地', is_active: true };
		const result = await updateVenue('v1', body);

		expect(api).toHaveBeenCalledWith('/venues/v1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual(updated);
	});

	it('propagates a rejected request (e.g. 404 查無此場館) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /venues/missing': new Error('not found') }));
		await expect(updateVenue('missing', { name: 'x' })).rejects.toThrow('not found');
	});
});

describe('getTickets — GET /products（admin 自帶分頁抓取，不假道 public listProducts()，Task 17）', () => {
	it('ntd 轉換價格；sold/quota 直接來自後端；merchandise 濾除；product_type 直接映射為 TicketType（Task F1 收斂，不再折疊成 pass/trial/event）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /products?page=1': {
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
					per_page: 20
				}
			})
		);

		const d = await getTickets();

		expect(api).toHaveBeenCalledWith('/products?page=1');
		expect(d.tickets).toHaveLength(3); // merchandise 濾除
		expect(d.tickets.find((t) => t.id === 'p1')).toMatchObject({ type: 'membership', price: 2800, sold: 45, quota: null });
		expect(d.tickets.find((t) => t.id === 'p2')).toMatchObject({ type: 'course_package', price: 5400, sold: 12, quota: 100 });
		expect(d.tickets.find((t) => t.id === 'p3')).toMatchObject({ type: 'ticket', price: 350, sold: 200, quota: null });
		expect(d.tickets.find((t) => t.id === 'p4')).toBeUndefined();
		expect(d.total).toBe(4);
		expect(d.page).toBe(1);
		expect(d.perPage).toBe(20);
	});

	it('page 參數帶入 query string（預設第 1 頁）；total/page/per_page 穿透為 total/page/perPage', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /products?page=2': { products: [], total: 37, page: 2, per_page: 20 }
			})
		);

		const d = await getTickets(2);

		expect(api).toHaveBeenCalledWith('/products?page=2');
		expect(d.tickets).toEqual([]);
		expect(d.total).toBe(37);
		expect(d.page).toBe(2);
		expect(d.perPage).toBe(20);
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
				'GET /orders?page=1': {
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

		expect(api).toHaveBeenCalledWith('/orders?page=1');
		expect(d.orders).toHaveLength(6);
		expect(d.orders.map((o) => o.status)).toEqual(['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded']);

		const first = d.orders[0];
		expect(first.id).toBe('DF-1'); // 顯示用 id = order_number
		expect(first.orderId).toBe('1'); // 真實後端 UUID = o.id（Task 8 piece 2 PATCH 用這個）
		expect(first.member).toBe('王小明');
		expect(first.initial).toBe('王');
		expect(first.amount).toBe(4800); // ntd(480000)
		expect(first.method).toBe('線上');
		expect(first.date).toBe('2026-06-08');
		expect(first.discount).toBe(''); // coupon_code ?? ''
		expect(first.paidAt).toBe('—（待付款）'); // pending → placeholder

		expect(d.orders[1].paidAt).toBe('2026-06-08'); // paid → real date
		expect(d.orders[5].discount).toBe('SPRING10');
		expect(d.total).toBe(6);
		expect(d.page).toBe(1);
		expect(d.perPage).toBe(100);
	});

	it('page 參數帶入 query string；total/page/per_page 穿透為 total/page/perPage（Task 17）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?page=2': { orders: [], total: 53, page: 2, per_page: 20 }
			})
		);

		const d = await getOrders(2);

		expect(api).toHaveBeenCalledWith('/orders?page=2');
		expect(d.orders).toEqual([]);
		expect(d.total).toBe(53);
		expect(d.page).toBe(2);
		expect(d.perPage).toBe(20);
	});

	it('由 amount 反推 5% 內含稅：480000 分 → amount 4800 / tax 229 / net 4571（站點級 pin）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?page=1': {
					orders: [{ id: '1', order_number: 'DF-1', user_name: '王小明', status: 'paid', total_cents: 480000, ...base }],
					total: 1,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getOrders();

		const o = d.orders[0];
		expect(o.amount).toBe(4800);
		expect(o.tax).toBe(229);
		expect(o.net).toBe(4571);
		expect(o.net + o.tax).toBe(o.amount);
	});

	it('item 摘要依 items 數量組成：0 項 fallback 訂單編號、1 項用該項名稱、N>1 項用「第一項 外 N-1 項」', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /orders?page=1': {
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

describe('updateOrderStatus — PATCH /orders/{id}/status（admin，Task 8 piece 2）', () => {
	it('PATCHes /orders/{real uuid}/status with { status } and returns the response', async () => {
		const response = { id: 'uuid-1', order_number: 'DF-1', status: 'processing' };
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /orders/uuid-1/status': response }));

		const result = await updateOrderStatus('uuid-1', 'processing');

		expect(api).toHaveBeenCalledWith('/orders/uuid-1/status', {
			method: 'PATCH',
			body: JSON.stringify({ status: 'processing' })
		});
		expect(result).toEqual(response);
	});

	it('propagates a rejected request (e.g. 400 illegal transition) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /orders/uuid-1/status': new Error('illegal transition') })
		);
		await expect(updateOrderStatus('uuid-1', 'paid')).rejects.toThrow('illegal transition');
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

describe('getClasses — GET /courses（admin 自帶分頁抓取，不假道 public listCourses()，Task 17）+ GET /coaches 供教練對照/picker', () => {
	it('enrolled/cap/wait 直接來自 enrolled_count/max_students/waitlist_count；price 經 ntd；schedule_text 拆分 day/time；coach_id 對照出教練姓名；duration_minutes 映射為 durationMinutes', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /courses?page=1': {
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
						},
						{
							// FE#17：後端 Task 7 起 course_level 補齊 5 值(foundation/elite) ——
							// 這兩筆課程過去用舊的 3→5 折疊 helper永遠對不出繁中標籤，現在必須
							// 直接對到 啟蒙/選手，證明折疊 helper 移除後 5 級真的直通。
							id: 'c4', name: '幼兒體操 啟蒙班', slug: 'w', level: 'foundation', description: null,
							duration_minutes: 45, price_cents: 260000, max_students: 8, min_age: 2, max_age: 4,
							features: [], is_active: true, coach_id: null, category: '幼兒體操', schedule_text: null,
							is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 3, waitlist_count: 0
						},
						{
							id: 'c5', name: '競技體操 菁英選手班', slug: 'v', level: 'elite', description: null,
							duration_minutes: 120, price_cents: 680000, max_students: 12, min_age: 9, max_age: 15,
							features: [], is_active: true, coach_id: null, category: '競技體操', schedule_text: null,
							is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 11, waitlist_count: 3
						}
					],
					total: 5,
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

		// courses 現改為 admin 專用分頁抓取(不帶 auth:false)；coaches 仍借道 Task 14 public
		// listCoaches() 公開端點(auth:false)。
		expect(api).toHaveBeenCalledWith('/courses?page=1');
		expect(api).toHaveBeenCalledWith('/coaches', { auth: false });
		expect(d.classes).toHaveLength(5);
		expect(d.coaches).toEqual([
			expect.objectContaining({ id: 'co1', name: '林教練' })
		]);
		expect(d.total).toBe(5);
		expect(d.page).toBe(1);
		expect(d.perPage).toBe(100);

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
		expect(c1.durationMinutes).toBe(90);

		const c2 = d.classes.find((c) => c.id === 'c2')!;
		expect(c2.day).toBe(''); // schedule_text: null 的 fallback
		expect(c2.time).toBe('');
		expect(c2.status).toBe('招生中'); // 7 < 10, wait=0
		expect(c2.coach).toBe(''); // 無 coach_id
		expect(c2.level).toBe('入門'); // beginner → 入門
		expect(c2.durationMinutes).toBe(60);

		const c3 = d.classes.find((c) => c.id === 'c3')!;
		expect(c3.status).toBe('候補'); // 8 < 10 但 wait=2 > 0
		expect(c3.level).toBe('基礎'); // intermediate → 基礎
		expect(c3.age).toBe('12 歲以上'); // 只有 min_age
		expect(c3.durationMinutes).toBe(90);

		const c4 = d.classes.find((c) => c.id === 'c4')!;
		expect(c4.level).toBe('啟蒙'); // foundation → 啟蒙 (FE#17：折疊 helper 移除前永遠對不出來)
		expect(c4.durationMinutes).toBe(45);

		const c5 = d.classes.find((c) => c.id === 'c5')!;
		expect(c5.level).toBe('選手'); // elite → 選手 (FE#17：折疊 helper 移除前永遠對不出來)
		expect(c5.durationMinutes).toBe(120);
	});

	it('page 參數帶入 query string；total/page/per_page 穿透為 total/page/perPage（Task 17）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /courses?page=2': { courses: [], total: 29, page: 2, per_page: 20 },
				'GET /coaches': []
			})
		);

		const d = await getClasses(2);

		expect(api).toHaveBeenCalledWith('/courses?page=2');
		expect(d.classes).toEqual([]);
		expect(d.total).toBe(29);
		expect(d.page).toBe(2);
		expect(d.perPage).toBe(20);
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

describe('createProduct — POST /products（admin，Task F1：票券寫入接線）', () => {
	it('POSTs the given body as-is and returns the ProductResponse', async () => {
		const created = {
			id: 'p-new', name: '新票券', slug: 'new-ticket', product_type: 'ticket', description: null,
			price_cents: 60000, original_price_cents: null, features: [], is_highlighted: false,
			badge: null, stock: null, quota: null, sold: 0, valid_days: null, session_count: null,
			is_active: true, created_at: '', updated_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /products': created }));

		const body = { name: '新票券', product_type: 'ticket', price_cents: 60000, stock: null };
		const result = await createProduct(body);

		expect(api).toHaveBeenCalledWith('/products', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 422/409) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /products': new Error('conflict') }));
		await expect(createProduct({ name: 'x', product_type: 'ticket', price_cents: 100 })).rejects.toThrow(
			'conflict'
		);
	});
});

describe('updateProduct — PATCH /products/{id}（admin，Task F1：票券寫入接線）', () => {
	it('PATCHes /products/{id} with the given (partial) body and returns the ProductResponse', async () => {
		const updated = {
			id: 'p1', name: '改名票券', slug: 'x', product_type: 'membership', description: null,
			price_cents: 320000, original_price_cents: null, features: [], is_highlighted: false,
			badge: null, stock: null, quota: null, sold: 45, valid_days: 30, session_count: null,
			is_active: true, created_at: '', updated_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /products/p1': updated }));

		const body = { name: '改名票券', price_cents: 320000, stock: null };
		const result = await updateProduct('p1', body);

		expect(api).toHaveBeenCalledWith('/products/p1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual(updated);
	});
});

describe('getCoaches — GET /coaches（公開端點）', () => {
	it('name/initial 改用真 name 欄位（不再借用 title）；title 為職稱且不同字；userId 帶 user_id；isActive 直接映射 is_active；phone/years/students/awards/classes/status 已隨欄位收斂移除(Task F5)', async () => {
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
				userId: 'u1',
				name: '林雅婷',
				initial: '林',
				title: '資深競技體操教練',
				color: expect.any(String),
				tags: ['競技體操', '競技啦啦隊'],
				isActive: true
			}
		]);
	});

	it('isActive 為 false 時原樣映射（例：教練檔案已停用/未公開顯示）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /coaches': [
					{
						id: 'co2', user_id: 'u2', name: '陳教練', title: '兼任教練', bio: null, experience: null,
						specialties: [], certifications: [], is_active: false,
						display_order: 0, slug: null, photo_url: null, created_at: ''
					}
				]
			})
		);
		const d = await getCoaches();
		expect(d.coaches[0].isActive).toBe(false);
	});
});

describe('createCoach — POST /coaches（admin，Task F5：教練建立/編輯接線）', () => {
	it('POSTs the given body as-is and returns the CoachResponse', async () => {
		const created = {
			id: 'co-new', user_id: 'u-new', name: '新教練', title: '兼任教練', bio: null, experience: null,
			specialties: ['跑酷'], certifications: [], is_active: true, display_order: 0, slug: null,
			photo_url: null, created_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /coaches': created }));

		const body = { user_id: 'u-new', title: '兼任教練', specialties: ['跑酷'], is_active: true };
		const result = await createCoach(body);

		expect(api).toHaveBeenCalledWith('/coaches', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 404 user_id 查無此使用者) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /coaches': new ApiError(404, 'user not found') })
		);
		await expect(createCoach({ user_id: 'missing', title: 'x' })).rejects.toThrow('user not found');
	});

	it('propagates a rejected request (e.g. 409 該 user 已是教練) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /coaches': new ApiError(409, 'user is already a coach') })
		);
		await expect(createCoach({ user_id: 'u1', title: 'x' })).rejects.toThrow('user is already a coach');
	});
});

describe('updateCoach — PATCH /coaches/{id}（admin，Task F5：教練建立/編輯接線）', () => {
	it('PATCHes /coaches/{id} with the given (partial) body and returns the CoachResponse', async () => {
		const updated = {
			id: 'co1', user_id: 'u1', name: '林雅婷', title: '改職稱', bio: null, experience: '12年資深教練',
			specialties: ['競技體操'], certifications: ['國家級'], is_active: false, display_order: 1,
			slug: null, photo_url: null, created_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /coaches/co1': updated }));

		const body = { title: '改職稱', specialties: ['競技體操'], is_active: false };
		const result = await updateCoach('co1', body);

		expect(api).toHaveBeenCalledWith('/coaches/co1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual(updated);
	});

	it('propagates a rejected request (404 查無此教練) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /coaches/missing': new ApiError(404, 'coach not found') })
		);
		await expect(updateCoach('missing', { title: 'x' })).rejects.toThrow('coach not found');
	});
});

describe('getCoupons — GET /coupons（admin，Task 8 piece 3）', () => {
	it('映射 discount_cents→NT$(ntd)、is_active→active、expires_at 取日期前 10 碼', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /coupons?page=1': {
					coupons: [
						{ id: 'cp1', code: 'SPRING10', discount_cents: 30000, is_active: true, expires_at: '2026-12-31T23:59:59Z', created_at: '2026-01-01T00:00:00Z' },
						{ id: 'cp2', code: 'WELCOME50', discount_cents: 5000, is_active: false, expires_at: null, created_at: '2026-01-01T00:00:00Z' }
					],
					total: 2,
					page: 1,
					per_page: 100
				}
			})
		);

		const d = await getCoupons();

		expect(api).toHaveBeenCalledWith('/coupons?page=1');
		expect(d.coupons).toEqual([
			{ id: 'cp1', code: 'SPRING10', discount: 300, active: true, expiresAt: '2026-12-31' },
			{ id: 'cp2', code: 'WELCOME50', discount: 50, active: false, expiresAt: '—' }
		]);
		expect(d.total).toBe(2);
		expect(d.page).toBe(1);
		expect(d.perPage).toBe(100);
	});

	it('page 參數帶入 query string；total/page/per_page 穿透為 total/page/perPage（Task 17）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /coupons?page=2': { coupons: [], total: 22, page: 2, per_page: 20 }
			})
		);

		const d = await getCoupons(2);

		expect(api).toHaveBeenCalledWith('/coupons?page=2');
		expect(d.coupons).toEqual([]);
		expect(d.total).toBe(22);
		expect(d.page).toBe(2);
		expect(d.perPage).toBe(20);
	});
});

describe('createCoupon — POST /coupons（admin，Task 8 piece 3）', () => {
	it('POSTs the given body as-is and returns the CouponResponse', async () => {
		const created = { id: 'cp-new', code: 'NEWCODE', discount_cents: 20000, is_active: true, expires_at: null, created_at: '' };
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /coupons': created }));

		const body = { code: 'NEWCODE', discount_cents: 20000 };
		const result = await createCoupon(body);

		expect(api).toHaveBeenCalledWith('/coupons', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 409 duplicate code / 422 validation) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /coupons': new Error('coupon code already exists') })
		);
		await expect(createCoupon({ code: 'DUP', discount_cents: 100 })).rejects.toThrow(
			'coupon code already exists'
		);
	});
});

describe('updateCoupon — PATCH /coupons/{id}（admin，Task F6：優惠碼編輯/停用接線）', () => {
	it('PATCHes /coupons/{id} with the given (partial) body and returns the CouponResponse', async () => {
		const updated = {
			id: 'cp1', code: 'SPRING10', discount_cents: 45000, is_active: false, expires_at: null, created_at: ''
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /coupons/cp1': updated }));

		const body = { discount_cents: 45000, is_active: false, expires_at: null };
		const result = await updateCoupon('cp1', body);

		expect(api).toHaveBeenCalledWith('/coupons/cp1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual(updated);
	});

	it('propagates a rejected request (e.g. 404 查無此 coupon) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /coupons/missing': new Error('not found') }));
		await expect(updateCoupon('missing', { is_active: false })).rejects.toThrow('not found');
	});
});

describe('deleteCoupon — DELETE /coupons/{id}（admin，Task F6：優惠碼刪除接線）', () => {
	it('DELETEs /coupons/{id} and resolves with no value (204 No Content)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /coupons/cp1': undefined }));

		await expect(deleteCoupon('cp1')).resolves.toBeUndefined();
		expect(api).toHaveBeenCalledWith('/coupons/cp1', { method: 'DELETE' });
	});

	it('propagates a rejected request (e.g. 404 查無此 coupon) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /coupons/missing': new Error('not found') }));
		await expect(deleteCoupon('missing')).rejects.toThrow('not found');
	});
});

describe('getMembers — GET /users（admin）', () => {
	it('映射 id/name/initial/phone/joined/status/points（binding 欄位規格）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users?page=1': {
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

		expect(api).toHaveBeenCalledWith('/users?page=1');
		expect(d.members).toEqual([
			{ id: 'u1', name: '王小明', initial: '王', phone: '0912345678', joined: '2026-01-15', status: 'active', points: 1250 },
			{ id: 'u2', name: '陳小華', initial: '陳', phone: '', joined: '2026-02-01', status: 'inactive', points: 0 }
		]);
		expect(d.total).toBe(2);
		expect(d.page).toBe(1);
		expect(d.perPage).toBe(100);
	});

	it('page 參數帶入 query string；total/page/per_page 穿透為 total/page/perPage（Task 17）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users?page=2': { users: [], total: 61, page: 2, per_page: 20 }
			})
		);

		const d = await getMembers(2);

		expect(api).toHaveBeenCalledWith('/users?page=2');
		expect(d.members).toEqual([]);
		expect(d.total).toBe(61);
		expect(d.page).toBe(2);
		expect(d.perPage).toBe(20);
	});
});

describe('mapMemberAccount（純函式）', () => {
	it('由姓名推導 initial；null phone 給空字串；is_active 轉 active/inactive', () => {
		expect(
			mapMemberAccount({ id: 'x', name: '測試員', phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: 10 })
		).toEqual({ id: 'x', name: '測試員', initial: '測', phone: '', joined: '2026-01-01', status: 'active', points: 10 });
	});
});

describe('createMember — POST /users（admin，Task 16）', () => {
	it('POSTs the given body as-is and returns the response mapped through mapMemberAccount (same shape as getMembers)', async () => {
		const created = {
			id: 'u-new', name: '新學員', phone: '0911222333', created_at: '2026-07-01T00:00:00Z',
			is_active: true, points_balance: 0
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /users': created }));

		const body = { email: 'new@example.com', name: '新學員', phone: '0911222333', password: 'abcd1234' };
		const result = await createMember(body);

		expect(api).toHaveBeenCalledWith('/users', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual({
			id: 'u-new', name: '新學員', initial: '新', phone: '0911222333', joined: '2026-07-01',
			status: 'active', points: 0
		});
	});

	it('POSTs birth_date through as-is when provided（Round 4 Task P4-F4）', async () => {
		const created = {
			id: 'u-new2', name: '新學員二', phone: null, created_at: '2026-07-01T00:00:00Z',
			is_active: true, points_balance: 0
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /users': created }));

		const body = { email: 'new2@example.com', name: '新學員二', password: 'abcd1234', birth_date: '2015-06-12' };
		await createMember(body);

		expect(api).toHaveBeenCalledWith('/users', { method: 'POST', body: JSON.stringify(body) });
	});

	it('propagates a rejected request (409 email 重複) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /users': new ApiError(409, 'Email 已被使用') })
		);
		await expect(
			createMember({ email: 'dup@example.com', name: '重複', password: 'abcd1234' })
		).rejects.toThrow('Email 已被使用');
	});

	it('propagates a rejected request (422 password < 8) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /users': new ApiError(422, 'password too short') })
		);
		await expect(
			createMember({ email: 'x@example.com', name: 'X', password: 'short' })
		).rejects.toThrow('password too short');
	});
});

describe('updateMember — PATCH /users/{id}（admin，Task 16）', () => {
	it('PATCHes /users/{id} with the given (partial) body and returns the response mapped through mapMemberAccount', async () => {
		const updated = {
			id: 'u1', name: '改名學員', phone: '0922333444', created_at: '2026-01-15T00:00:00Z',
			is_active: false, points_balance: 1250
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /users/u1': updated }));

		const body = { name: '改名學員', phone: '0922333444', is_active: false };
		const result = await updateMember('u1', body);

		expect(api).toHaveBeenCalledWith('/users/u1', { method: 'PATCH', body: JSON.stringify(body) });
		expect(result).toEqual({
			id: 'u1', name: '改名學員', initial: '改', phone: '0922333444', joined: '2026-01-15',
			status: 'inactive', points: 1250
		});
	});

	it('sends whatever (possibly empty) body it is given — 全 None 交由後端 422 判斷，seam 不自行攔截', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /users/u1': new ApiError(422, '至少提供一個欄位') })
		);
		await expect(updateMember('u1', {})).rejects.toThrow('至少提供一個欄位');
		expect(api).toHaveBeenCalledWith('/users/u1', { method: 'PATCH', body: JSON.stringify({}) });
	});

	it('propagates a rejected request (404 查無此使用者) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /users/missing': new ApiError(404, 'user not found') })
		);
		await expect(updateMember('missing', { name: 'X' })).rejects.toThrow('user not found');
	});
});

describe('getTodaySessions — GET /sessions/today（admin 分支，§3.18，Task F11：儀表板今日課表接真）', () => {
	it('映射 time(HH:MM)/name/count；coach_name/venue 皆有值時直接映射；state 依目前時間推導(09:30 落在 09:00–10:00 場次中 → live)', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 10, 9, 30, 0));
		try {
			vi.mocked(api).mockImplementation(
				fakeRouter({
					'GET /sessions/today': [
						{
							id: 's1', course_id: 'c1', course_name: '兒童體操 初階班', coach_name: '黃詩涵',
							start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 6, venue: 'C 軟墊區'
						}
					]
				})
			);

			const d = await getTodaySessions();

			expect(api).toHaveBeenCalledWith('/sessions/today');
			expect(d.sessions).toEqual([
				{ time: '09:00', name: '兒童體操 初階班', coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'live', tone: 'success', label: '上課中' }
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('coach_name 為 null(尚未指定教練)、venue 為 null(反推不到對應 slot)時皆映射為「—」', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /sessions/today': [
					{
						id: 's2', course_id: 'c2', course_name: '跑酷體驗班', coach_name: null,
						start_time: '08:00:00', end_time: '09:00:00', enrolled_count: 3, venue: null
					}
				]
			})
		);

		const d = await getTodaySessions();

		expect(d.sessions[0].coach).toBe('—');
		expect(d.sessions[0].room).toBe('—');
	});

	it('state 推導(復用 $lib/domain/sessions 的 deriveSessionStatus)：now < start_time → wait/尚未開始', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 10, 7, 0, 0));
		try {
			vi.mocked(api).mockImplementation(
				fakeRouter({
					'GET /sessions/today': [
						{ id: 's1', course_id: 'c1', course_name: 'X', coach_name: null, start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 1, venue: null }
					]
				})
			);

			const d = await getTodaySessions();
			expect(d.sessions[0]).toMatchObject({ state: 'wait', tone: 'neutral', label: '尚未開始' });
		} finally {
			vi.useRealTimers();
		}
	});

	it('state 推導：now >= end_time → done/已結束', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 10, 11, 0, 0));
		try {
			vi.mocked(api).mockImplementation(
				fakeRouter({
					'GET /sessions/today': [
						{ id: 's1', course_id: 'c1', course_name: 'X', coach_name: null, start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 1, venue: null }
					]
				})
			);

			const d = await getTodaySessions();
			expect(d.sessions[0]).toMatchObject({ state: 'done', tone: 'neutral', label: '已結束' });
		} finally {
			vi.useRealTimers();
		}
	});

	it('今日無場次時回傳空陣列，不是 500', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /sessions/today': [] }));
		const d = await getTodaySessions();
		expect(d.sessions).toEqual([]);
	});

	/* Important #2(b)(終審)：deriveSessionStatus 宣告的回傳型別 TodayStatus 是 4 值
	 * 聯集(soon 是現行實作推導不到、但型別上合法的第 4 值)。之前 mapTodaySession 把
	 * 回傳值窄化 cast 成 'wait'|'live'|'done' 3 態去查一張只有 3 個 key 的表——查表
	 * 一旦真的遇到 soon 就會 destructure 到 undefined 而炸掉。SESSION_STATUS(C4 起
	 * 單源收斂至 $lib/domain/sessions)現已補齊 soon 分支、移除窄化 cast，這裡用
	 * mock 強制 deriveSessionStatus 回傳 soon 驗證查表能正確降級，不會炸。 */
	it('state 推導：deriveSessionStatus 回傳 soon(現行實作不會產生，但型別合法的第 4 態)時查表仍有對應 tone/label，不會炸掉', async () => {
		vi.mocked(deriveSessionStatus).mockReturnValueOnce('soon');
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /sessions/today': [
					{ id: 's1', course_id: 'c1', course_name: 'X', coach_name: null, start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 1, venue: null }
				]
			})
		);

		const d = await getTodaySessions();
		expect(d.sessions[0]).toMatchObject({ state: 'soon', tone: 'warning', label: '即將開始' });
	});
});

describe('getRecentActivity — GET /reports/admin/activity（§3.24，Task F11：儀表板最新動態接真）', () => {
	it('kind→icon/tone/bg 對照涵蓋 user/order/enrolment/inquiry 4 種 kind；label(已含中文/金額)原樣映射為 text；occurred_at 轉為顯示時間', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /reports/admin/activity': {
					items: [
						{ kind: 'user', label: '新會員註冊:謝佩珊', occurred_at: '2026-07-10T09:12:00Z' },
						{ kind: 'order', label: '訂單 DF-24061 已付款:NT$4,800', occurred_at: '2026-07-10T08:40:00Z' },
						{ kind: 'enrolment', label: '新報名:兒童基礎 B 班', occurred_at: '2026-07-10T08:00:00Z' },
						{ kind: 'inquiry', label: '新洽詢(trial):王小明', occurred_at: '2026-07-10T07:30:00Z' }
					]
				}
			})
		);

		const d = await getRecentActivity();

		expect(api).toHaveBeenCalledWith('/reports/admin/activity');
		expect(d.activity).toEqual([
			{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新會員註冊:謝佩珊', time: '2026-07-10 09:12' },
			{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '訂單 DF-24061 已付款:NT$4,800', time: '2026-07-10 08:40' },
			{ icon: 'book-open', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新報名:兒童基礎 B 班', time: '2026-07-10 08:00' },
			{ icon: 'message-circle', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', text: '新洽詢(trial):王小明', time: '2026-07-10 07:30' }
		]);
	});

	it('空庫：items 為 [] 時回傳空陣列，不是 500', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /reports/admin/activity': { items: [] } }));
		const d = await getRecentActivity();
		expect(d.activity).toEqual([]);
	});
});

describe('getSettings — GET /settings（admin，契約 §3.25，Task F9：系統設定頁接真）', () => {
	it('映射三個慣例 key：studio_profile 欄位改 camelCase(default_ratio→defaultRatio 等)，notification_flags/security 逐欄位原樣穿透(camelCase 對齊，契約裁決 4)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /settings': {
					settings: {
						studio_profile: {
							name: '夢想體操館',
							phone: '04-1111-2222',
							address: '台北市',
							default_ratio: '1:4',
							max_class_size: 8
						},
						notification_flags: { email: false, sms: true, lowAtt: false, autoWait: false },
						security: { twoFA: false }
					}
				}
			})
		);

		const d = await getSettings();

		expect(api).toHaveBeenCalledWith('/settings');
		expect(d).toEqual({
			studioProfile: {
				name: '夢想體操館',
				phone: '04-1111-2222',
				address: '台北市',
				defaultRatio: '1:4',
				maxClassSize: 8
			},
			notificationFlags: { email: false, sms: true, lowAtt: false, autoWait: false },
			security: { twoFA: false }
		});
	});

	it('新裝機：settings 為空物件 {} 時，三組皆補齊完整前端預設值(不留 undefined 欄位)', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': { settings: {} } }));

		const d = await getSettings();

		expect(d).toEqual({
			studioProfile: {
				name: 'Dream Fly 夢飛體操館',
				phone: '04-2376-1688',
				address: '台中市西區美村路一段 168 號',
				defaultRatio: '1:6',
				maxClassSize: 12
			},
			notificationFlags: { email: true, sms: false, lowAtt: true, autoWait: true },
			security: { twoFA: true }
		});
	});

	it('部分欄位：某個慣例 key 只有部分子欄位時，缺的子欄位個別補預設值，而非整組回退預設(逐欄位填補，非整包替換)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /settings': {
					settings: {
						studio_profile: { name: '只改了名稱' },
						notification_flags: { sms: true }
					}
				}
			})
		);

		const d = await getSettings();

		expect(d.studioProfile).toEqual({
			name: '只改了名稱',
			phone: '04-2376-1688', // 缺席欄位補預設
			address: '台中市西區美村路一段 168 號',
			defaultRatio: '1:6',
			maxClassSize: 12
		});
		expect(d.notificationFlags).toEqual({ email: true, sms: true, lowAtt: true, autoWait: true });
		expect(d.security).toEqual({ twoFA: true }); // security key 整個缺席 → 全預設
	});

	it('propagates a rejected request (e.g. 403 非 admin) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /settings': new ApiError(403, 'forbidden') }));
		await expect(getSettings()).rejects.toThrow('forbidden');
	});
});

describe('putSettings — PUT /settings（admin，契約 §3.25，Task F9：系統設定頁接真）', () => {
	it('包成 { settings: body } 送出(逐 key upsert)，回應同 GET 經同一支映射', async () => {
		const responseAfterPut = {
			settings: {
				studio_profile: {
					name: '改名體操館',
					phone: '04-2376-1688',
					address: '台中市西區美村路一段 168 號',
					default_ratio: '1:8',
					max_class_size: 10
				},
				notification_flags: { email: false, sms: false, lowAtt: true, autoWait: true },
				security: { twoFA: false }
			}
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /settings': responseAfterPut }));

		const body = {
			studio_profile: { name: '改名體操館', default_ratio: '1:8', max_class_size: 10 },
			notification_flags: { email: false, sms: false, lowAtt: true, autoWait: true },
			security: { twoFA: false }
		};
		const result = await putSettings(body);

		expect(api).toHaveBeenCalledWith('/settings', {
			method: 'PUT',
			body: JSON.stringify({ settings: body })
		});
		expect(result).toEqual({
			studioProfile: {
				name: '改名體操館',
				phone: '04-2376-1688',
				address: '台中市西區美村路一段 168 號',
				defaultRatio: '1:8',
				maxClassSize: 10
			},
			notificationFlags: { email: false, sms: false, lowAtt: true, autoWait: true },
			security: { twoFA: false }
		});
	});

	it('空物件 {} 送出視為 no-op(契約裁決 2)：body 序列化為 { settings: {} }，不是 400', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PUT /settings': { settings: {} } })
		);

		await putSettings({});

		expect(api).toHaveBeenCalledWith('/settings', {
			method: 'PUT',
			body: JSON.stringify({ settings: {} })
		});
	});

	it('propagates a rejected request (e.g. 403 非 admin) to the caller', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /settings': new ApiError(403, 'forbidden') }));
		await expect(putSettings({ security: { twoFA: true } })).rejects.toThrow('forbidden');
	});
});
