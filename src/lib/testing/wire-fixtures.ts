/* wire fixture builders（W-6，ADR 0027）——後端產生型別（$lib/api/generated）的測試夾具。
 *
 * 每支 builder 回傳完整的產生型別、帶合理預設值，呼叫端以 `Partial<T>` 只覆寫該測試在意
 * 的欄位。後端 DTO 加欄位時，check 會在這裡（而不是散落各測試檔的 mock 字面值）紅，
 * 只需補預設值。只供測試使用（$lib/testing 不得進 production bundle，見 import-scan.test）。 */
import type {
	ActivityItem,
	AdminLeaveRequestResponse,
	AdminOrderSummary,
	AdminReportResponse,
	CoachResponse,
	CouponResponse,
	CourseResponse,
	InquiryResponse,
	LeaveRequestResponse,
	OrderResponse,
	OrderSummary,
	PointsMeResponse,
	ProductResponse,
	SettingsResponse,
	TodaySessionResponse,
	UserResponse,
	VenueResponse
} from '$lib/api/generated';

export const orderSummary = (over: Partial<OrderSummary> = {}): OrderSummary => ({
	id: 'order-1',
	order_number: 'DF-1',
	status: 'paid',
	total_cents: 100000,
	created_at: '2026-06-08T14:22:00Z',
	items: [],
	...over
});

export const adminOrderSummary = (over: Partial<AdminOrderSummary> = {}): AdminOrderSummary => ({
	id: 'order-1',
	order_number: 'DF-1',
	user_name: '王小明',
	user_email: 'a@b.com',
	status: 'paid',
	total_cents: 100000,
	points_used: 0,
	coupon_code: null,
	paid_at: '2026-06-08T14:22:00Z',
	created_at: '2026-06-08T14:22:00Z',
	items: [],
	...over
});

export const orderResponse = (over: Partial<OrderResponse> = {}): OrderResponse => ({
	id: 'order-1',
	order_number: 'DF-1',
	status: 'paid',
	total_cents: 100000,
	discount_cents: 0,
	coupon_code: null,
	points_used: 0,
	points_earned: 0,
	payment_method: 'credit_card',
	paid_at: '2026-06-08T14:22:00Z',
	created_at: '2026-06-08T14:22:00Z',
	items: [],
	enrolments: [],
	subscriptions: [],
	...over
});

export const leaveRequest = (over: Partial<LeaveRequestResponse> = {}): LeaveRequestResponse => ({
	id: 'lr-1',
	course_id: 'course-1',
	course_name: '體操基礎班',
	session_id: 'session-1',
	session_date: '2026-06-20',
	start_time: '10:00:00',
	reason: null,
	status: 'pending',
	makeup_session_id: null,
	makeup_session_date: null,
	makeup_start_time: null,
	decided_at: null,
	created_at: '2026-06-10T00:00:00Z',
	...over
});

export const adminLeaveRequest = (over: Partial<AdminLeaveRequestResponse> = {}): AdminLeaveRequestResponse => ({
	...leaveRequest(),
	user_id: 'user-1',
	user_name: '王小明',
	...over
});

export const pointsMe = (over: Partial<PointsMeResponse> = {}): PointsMeResponse => ({
	balance: 0,
	earned_this_month: 0,
	ledger: [],
	total: 0,
	page: 1,
	per_page: 20,
	...over
});

export const inquiryResponse = (over: Partial<InquiryResponse> = {}): InquiryResponse => ({
	id: 'inq-1',
	name: '王小明',
	email: 'a@b.com',
	phone: null,
	subject: '一般諮詢',
	message: '想詢問課程時間',
	status: 'new',
	assigned_to: null,
	inquiry_type: 'general',
	metadata: null,
	created_at: '',
	updated_at: '',
	...over
});

export const venueResponse = (over: Partial<VenueResponse> = {}): VenueResponse => ({
	id: 'venue-1',
	category_id: null,
	name: 'A 訓練館',
	slug: 'a-hall',
	description: null,
	features: [],
	image_url: null,
	is_active: true,
	created_at: '',
	...over
});

export const productResponse = (over: Partial<ProductResponse> = {}): ProductResponse => ({
	id: 'product-1',
	name: '單次體驗券',
	slug: 'trial-ticket',
	product_type: 'ticket',
	description: null,
	price_cents: 50000,
	original_price_cents: null,
	features: [],
	is_highlighted: false,
	badge: null,
	stock: null,
	quota: null,
	sold: 0,
	valid_days: null,
	session_count: null,
	is_active: true,
	created_at: '',
	updated_at: '',
	...over
});

export const couponResponse = (over: Partial<CouponResponse> = {}): CouponResponse => ({
	id: 'coupon-1',
	code: 'WELCOME',
	discount_cents: 10000,
	is_active: true,
	expires_at: null,
	created_at: '',
	...over
});

/** 新裝機形狀：settings 表沒有任何列（見 admin/api.ts getSettings 註解）。 */
export const settingsResponse = (over: Partial<SettingsResponse> = {}): SettingsResponse => ({
	settings: {},
	...over
});

/** 空庫形狀：計數全 0、比率 null、各 section 空陣列（契約允許空陣列，頁面須不炸）。 */
export const adminReportResponse = (over: Partial<AdminReportResponse> = {}): AdminReportResponse => ({
	revenue: { this_month_cents: 0, last_month_cents: 0, trend: [] },
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
	members: { total: 0, new_this_month: 0, active: 0 },
	courses: [],
	coaches: [],
	...over
});

export const activityItem = (over: Partial<ActivityItem> = {}): ActivityItem => ({
	kind: 'user',
	label: '新會員 王小明 加入',
	occurred_at: '2026-06-08T14:22:00Z',
	...over
});

export const todaySession = (over: Partial<TodaySessionResponse> = {}): TodaySessionResponse => ({
	id: 'session-1',
	course_id: 'course-1',
	course_name: '體操基礎班',
	coach_name: null,
	start_time: '10:00:00',
	end_time: '11:00:00',
	enrolled_count: 0,
	venue: null,
	status: 'upcoming',
	...over
});

export const coachResponse = (over: Partial<CoachResponse> = {}): CoachResponse => ({
	id: 'coach-1',
	user_id: 'user-1',
	name: '林教練',
	title: '體操教練',
	bio: null,
	experience: null,
	specialties: [],
	certifications: [],
	is_active: true,
	display_order: 0,
	slug: null,
	photo_url: null,
	created_at: '',
	...over
});

export const userResponse = (over: Partial<UserResponse> = {}): UserResponse => ({
	id: 'user-1',
	email: 'a@b.com',
	name: '王小明',
	phone: null,
	phone_verified: false,
	avatar_url: null,
	is_active: true,
	last_login: null,
	created_at: '2026-01-15T00:00:00Z',
	roles: ['member'],
	points_balance: 0,
	preferences: null,
	birth_date: null,
	...over
});

export const courseResponse = (over: Partial<CourseResponse> = {}): CourseResponse => ({
	id: 'course-1',
	name: '體操基礎班',
	slug: 'basic',
	level: 'intermediate',
	description: null,
	duration_minutes: 90,
	price_cents: 320000,
	max_students: 12,
	min_age: null,
	max_age: null,
	features: [],
	is_active: true,
	coach_id: null,
	category: null,
	schedule_text: null,
	is_highlighted: false,
	created_at: '',
	updated_at: '',
	enrolled_count: 0,
	waitlist_count: 0,
	...over
});
