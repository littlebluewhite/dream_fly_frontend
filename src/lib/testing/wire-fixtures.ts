/* wire fixture builders（W-6，ADR 0027）——後端產生型別（$lib/api/generated）的測試夾具。
 *
 * 每支 builder 回傳完整的產生型別、帶合理預設值，呼叫端以 `Partial<T>` 只覆寫該測試在意
 * 的欄位。後端 DTO 加欄位時，check 會在這裡（而不是散落各測試檔的 mock 字面值）紅，
 * 只需補預設值。只供測試使用（$lib/testing 不得進 production bundle，見 import-scan.test）。 */
import type {
	AdminLeaveRequestResponse,
	AdminOrderSummary,
	InquiryResponse,
	LeaveRequestResponse,
	OrderResponse,
	OrderSummary,
	PointsMeResponse
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
