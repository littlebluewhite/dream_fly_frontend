/* Dream Fly — mobile-admin ops 頁共用 wire fixture(R15 Task 3a·候選 轉手退役)。
 *
 * getOpsCollections()(members/classes/coaches/orders 一次水合)背後打的四個端點
 * GET /users?page=1、/courses?page=1、/coaches、/orders?page=1 的最小可用 wire
 * fixture，形狀取自 admin/api.test.ts :221(orders)/:366(courses)/:407(coaches)/
 * :786(users)。供各 mobile-admin 測試檔當 fakeRouter 的 defaults 使用，測試只需
 * 覆寫自己關心的路徑。 */
export const USERS_FIXTURE = [
	{ id: 'u1', name: '王小明', phone: '0912345678', created_at: '2026-01-15T00:00:00Z', is_active: true, points_balance: 1250 },
	{ id: 'u2', name: '陳小華', phone: null, created_at: '2026-02-01T00:00:00Z', is_active: false, points_balance: 0 }
];

export const COURSES_FIXTURE = [
	{
		id: 'c1', name: '競技體操 選手班', slug: 'x', level: 'advanced', description: null,
		duration_minutes: 90, price_cents: 620000, max_students: 12, min_age: 8, max_age: 14,
		features: [], is_active: true, coach_id: 'co1', category: '競技體操',
		schedule_text: '週二、四 17:00-19:00', is_highlighted: false, created_at: '', updated_at: '',
		enrolled_count: 12, waitlist_count: 4
	}
];

export const COACHES_FIXTURE = [
	{
		id: 'co1', user_id: 'u1', name: '林教練', title: '資深體操教練', bio: null, experience: null,
		specialties: ['競技體操'], certifications: [], is_active: true, display_order: 1,
		slug: null, photo_url: null, created_at: ''
	}
];

export const ORDERS_FIXTURE = [
	{
		id: '1', order_number: 'DF-1', user_name: '王小明', user_email: 'a@b.com', status: 'pending',
		total_cents: 480000, points_used: 0, coupon_code: null as string | null, created_at: '2026-06-08T14:22:00Z',
		items: [{ name: '競技體操 選手班', quantity: 1 }]
	}
];

/** fakeRouter 的 defaults 表——getOpsCollections() 平行拉取的四個端點都有交代，
 *  沒交代到的路徑(例如某測試自己要覆寫 coaches 清單)由該測試的 overrides 蓋過。 */
export const OPS_ROUTES: Record<string, unknown> = {
	'GET /users?page=1': { users: USERS_FIXTURE, total: USERS_FIXTURE.length, page: 1, per_page: 100 },
	'GET /courses?page=1': { courses: COURSES_FIXTURE, total: COURSES_FIXTURE.length, page: 1, per_page: 100 },
	'GET /coaches': COACHES_FIXTURE,
	'GET /orders?page=1': { orders: ORDERS_FIXTURE, total: ORDERS_FIXTURE.length, page: 1, per_page: 100 }
};
