/* 管理後台 API 接縫。Task 18：venues/tickets/orders/classes/coaches 換真後端資料；
 * getReports 沒有對應後端彙總端點，整包沿用 mock（P2）。回傳「形狀」盡量維持不變，
 * 頁面不用重寫樣板 —— 既有 Order/ClassRow/Coach/Venue/Ticket 型別維持原樣，後端沒有
 * 對應的欄位一律給誠實預設值（見各函式註解），呼叫端不用改。 */
import { api } from '$lib/api/client';
import { listCourses, listCoaches, listVenues, listProducts } from '$lib/public/api';
import type { ApiCourse, ApiCoach, ApiVenue, ApiProduct } from '$lib/public/api';
import { ntd, orderItemsSummary } from '$lib/public/adapters';
import {
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
	WEEKDAY_LOAD,
	MEMBER_COLORS,
	mapMemberAccount
} from './data';
import type {
	Ticket,
	TicketType,
	ClassRow,
	Level,
	ClassStatus,
	Coach,
	Venue,
	Order,
	OrderStatus,
	ReportKpi,
	RevenueRow,
	TrendBar,
	PctSlice,
	TopCourse,
	IncomeSource,
	CoachPerf,
	VenueUsage,
	CountBar,
	RetentionBar,
	CampusRevenue,
	FunnelStage,
	WeekdayLoad,
	MemberAccount,
	ApiUserAccount
} from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。getReports 仍為 mock,沿用此 helper。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/* ═════════════════════════ 場館（GET /venues，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** VenueResponse 沒有 type/area/cap/今日排課數欄位 —— features 語意上對應器材配置
 *  (equip)、is_active 對應可預約狀態(status，下線視為維護中)；其餘無對應欄位的
 *  一律誠實給預設值(P2：待後端補對應欄位)。 */
function mapVenue(v: ApiVenue): Venue {
	return {
		id: v.id,
		name: v.name,
		type: v.description ?? '', // 後端沒有專門的「場地類型」欄位，借用 description
		area: '', // P2: 後端無面積欄位
		cap: 0, // P2: 後端無容納人數欄位
		equip: v.features,
		status: v.is_active ? 'available' : 'maintenance',
		today: 0 // P2: 後端無「今日排課數」彙總欄位
	};
}

export interface VenuesData {
	venues: Venue[];
}
export const getVenues = (): Promise<VenuesData> =>
	listVenues().then((venues) => ({ venues: venues.map(mapVenue) }));

/* ═════════════════════════ 票券（GET /products，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** 後端 product_type（ticket|course_package|membership|merchandise）沒有跟前端三態
 *  （pass/trial/event）一一對應 —— 依語意最接近對照：membership/course_package
 *  （重複性方案／堂數包）→ pass、ticket（單次入場)→ event；沒有任何值會對到 trial
 *  （後端沒有「體驗」這個 product_type，P2）。merchandise（護具/隊服等實體商品）
 *  不是票券，直接濾除，不進 getTickets() 的結果。 */
const PRODUCT_TYPE_TO_TICKET_TYPE: Record<string, TicketType> = {
	membership: 'pass',
	course_package: 'pass',
	ticket: 'event'
};

/** sold/quota 現直接來自 ProductResponse（見 integration-contract.md §3.7）：
 *  `sold` 是已付款訂單的 quantity 加總；`quota` 是 `stock` 的直接映射，`null` = 不限
 *  （票券/方案類幾乎都是 null —— 只有 merchandise 才有限量庫存數字，而 merchandise
 *  已被 getTickets() 濾除）。null 顯示層由 routes/admin/tickets/+page.svelte 渲染
 *  「不限」，不用 0 頂替（0 在既有 UI 語意上會誤讀成「已無配額」）。圖示固定用通用
 *  icon(後端無圖示欄位)；color 依序輪替既有色票(後端無代表色欄位，純視覺裝飾)。 */
function mapProduct(p: ApiProduct, i: number): Ticket {
	return {
		id: p.id,
		name: p.name,
		type: PRODUCT_TYPE_TO_TICKET_TYPE[p.product_type] ?? 'pass',
		price: ntd(p.price_cents),
		sold: p.sold,
		quota: p.quota,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		icon: 'ticket',
		desc: p.description ?? ''
	};
}

export interface TicketsData {
	tickets: Ticket[];
}
export const getTickets = (): Promise<TicketsData> =>
	listProducts().then((products) => ({
		tickets: products.filter((p) => p.product_type !== 'merchandise').map(mapProduct)
	}));

/* ═════════════════════════ 訂單（GET /orders，admin-only） ═════════════════════════ */

interface ApiAdminOrder {
	id: string;
	order_number: string;
	user_name: string;
	user_email: string;
	status: OrderStatus;
	total_cents: number;
	points_used: number;
	coupon_code: string | null;
	created_at: string;
	items: { name: string; quantity: number }[];
}
interface ApiAdminOrderListResponse {
	orders: ApiAdminOrder[];
	total: number;
	page: number;
	per_page: number;
}

/** `AdminOrderSummary` → 既有 Order 形狀，讓 OrdersTable/OrderDialog 樣板不用改。
 *  AdminOrderSummary 沒有發票/經手人/分校欄位 —— 誠實給預設值(P2，各欄位見
 *  行內註解)；item 現由 items 摘要組成(orderItemsSummary，與 member/api.ts
 *  mapOrder 共用同一份措辭)；tax/net 由 amount 反推 5% 內含稅(沿用既有 data.ts
 *  ORDERS 的算法，非後端資料)；status 直接沿用後端 6 態原值(pending/paid/
 *  processing/completed/cancelled/refunded)，中文標籤由 ORDER_STATUS 查表
 *  (已於 data.ts 擴充至 6 態)。orderId 是真實後端 UUID（`o.id`）——Task 8 piece 2
 *  的 PATCH /orders/{id}/status 要用這個，`id` 欄位其實是 order_number（顯示用，
 *  維持既有 UI 不變)。 */
function mapAdminOrder(o: ApiAdminOrder, i: number): Order {
	const amount = ntd(o.total_cents);
	const tax = Math.round(amount - amount / 1.05);
	return {
		id: o.order_number,
		orderId: o.id,
		member: o.user_name,
		initial: o.user_name.charAt(0) || '?',
		color: MEMBER_COLORS[i % MEMBER_COLORS.length], // P2: 後端無代表色欄位
		item: orderItemsSummary(o.items, `訂單 ${o.order_number}`),
		amount,
		status: o.status,
		method: '線上', // 後端目前僅有模擬付款，沒有真實付款方式欄位
		date: o.created_at.slice(0, 10),
		invoice: '—', // P2: 後端無發票號碼欄位
		discount: o.coupon_code ?? '',
		handler: '—', // P2: 後端無經手人／客服歸屬欄位
		campus: '—', // P2: 訂單無分校欄位(courses/venues 目前也無分校維度)
		tax,
		net: amount - tax,
		paidAt: o.status === 'pending' ? '—（待付款）' : o.created_at.slice(0, 10),
		taxId: '—' // P2: 後端無統一編號欄位
	};
}

export interface OrdersData {
	orders: Order[];
}
export const getOrders = (): Promise<OrdersData> =>
	api<ApiAdminOrderListResponse>('/orders?per_page=100').then((r) => ({
		orders: r.orders.map(mapAdminOrder)
	}));

/* ── 訂單狀態變更（PATCH /orders/{id}/status，admin-only，Task 8 piece 2） ──
 * `id` here MUST be the real backend UUID (Order.orderId — see admin/data.ts),
 * not the display order_number (Order.id). Response is the FULL OrderResponse
 * (契約 §3.10）——不同於清單用的 AdminOrderSummary（缺 user_name/user_email，items
 * 也沒有 name），呼叫端只取其中的 status 套回本地working copy（orders-filter.ts 的
 * applyStatusChange），不整包重新映射。 */
export interface ApiOrderStatusResponse {
	id: string;
	order_number: string;
	status: string;
}

export const updateOrderStatus = (id: string, status: OrderStatus): Promise<ApiOrderStatusResponse> =>
	api<ApiOrderStatusResponse>(`/orders/${id}/status`, {
		method: 'PATCH',
		body: JSON.stringify({ status })
	});

/* ═════════════════════════ 報表分析（P2：無對應後端彙總端點，整包沿用 mock） ═════════════════════════ */

/** 報表分析整包:KPI 帶 + 15 個圖表元件消費的全部資料集。
 *  P2: 營收/出席/留存/客源等皆為多表聚合統計，後端目前無對應彙總端點，整包沿用 mock。 */
export interface ReportsData {
	kpis: ReportKpi[];
	revenueBreakdown: RevenueRow[];
	revenueTotal: string;
	revenueTrend: TrendBar[];
	categorySplit: PctSlice[];
	topCourses: TopCourse[];
	incomeSources: IncomeSource[];
	coachPerf: CoachPerf[];
	venueUsage: VenueUsage[];
	attDist: CountBar[];
	retention: RetentionBar[];
	ageDist: PctSlice[];
	tierDist: CountBar[];
	campusRevenue: CampusRevenue[];
	paymentSplit: PctSlice[];
	funnel: FunnelStage[];
	weekdayLoad: WeekdayLoad[];
}
export const getReports = (): Promise<ReportsData> =>
	reply({
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

/* ═════════════════════════ 課程（GET /courses，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** `schedule_text` 實測格式為 "週二、四 16:00-17:00"（day-part 與 time-part 以第
 *  一個空白分隔）；null 或找不到空白時，day 保留原字串（找不到空白）或空字串
 *  （null），time 一律給空字串。 */
function splitSchedule(text: string | null): { day: string; time: string } {
	if (!text) return { day: '', time: '' };
	const sp = text.indexOf(' ');
	return sp === -1 ? { day: text, time: '' } : { day: text.slice(0, sp), time: text.slice(sp + 1) };
}

/** 後端 level 只有 3 級（beginner/intermediate/advanced），對照到既有 5 級（啟蒙/
 *  入門/基礎/進階/選手，見 LEVELS）—— 啟蒙、選手是本地更細的分級，後端資料無法
 *  還原，一律不會出現。 */
const COURSE_LEVEL_TO_CLASS_LEVEL: Record<string, Level> = {
	beginner: '入門',
	intermediate: '基礎',
	advanced: '進階'
};

/** `[min_age, max_age]` 組成顯示用字串。同 public/adapters.ts 的私有 ageRange
 *  (該檔未 export)，這裡另存一份小對照，避免為了共用 3 行邏輯去改動 Task 14
 *  own 的檔案。 */
function ageRange(min: number | null, max: number | null): string {
	if (min != null && max != null) return `${min}–${max} 歲`;
	if (min != null) return `${min} 歲以上`;
	if (max != null) return `${max} 歲以下`;
	return '';
}

/** 開課狀態 —— 後端沒有對應的三態欄位，依真實人數推導：額滿(已達上限) > 候補
 *  (有候補人數但未額滿) > 招生中。 */
function classStatusOf(enrolled: number, cap: number, wait: number): ClassStatus {
	if (enrolled >= cap) return '額滿';
	if (wait > 0) return '候補';
	return '招生中';
}

/** `CourseResponse` → 既有 ClassRow 形狀。coach 姓名需靠 coach_id 對照教練列表
 *  (CourseResponse 本身沒有教練姓名欄位，需靠 getClasses() 內的 coachNameById 對照
 *  ——該表現在存的是 mapCoach() 輸出的真實 name)；room/term/sessions/startDate/
 *  checkinRate/makeup 後端無對應欄位，誠實給預設值(P2)。 */
export function mapCourse(c: ApiCourse, coachNameById: Map<string, string>): ClassRow {
	const { day, time } = splitSchedule(c.schedule_text);
	return {
		id: c.id,
		name: c.name,
		level: COURSE_LEVEL_TO_CLASS_LEVEL[c.level] ?? '基礎',
		cat: c.category ?? '',
		coach: c.coach_id ? (coachNameById.get(c.coach_id) ?? '') : '',
		room: '', // P2: 課程無場地欄位(無 course↔venue 關聯)
		day,
		time,
		enrolled: c.enrolled_count,
		cap: c.max_students,
		age: ageRange(c.min_age, c.max_age),
		price: ntd(c.price_cents),
		status: classStatusOf(c.enrolled_count, c.max_students, c.waitlist_count),
		wait: c.waitlist_count,
		term: '', // P2: 課程無期別欄位
		sessions: 0, // P2: 課程無本期堂數欄位(duration_minutes 是單堂時長，語意不同)
		startDate: '', // P2: 課程無開課日期欄位
		checkinRate: 0, // P2: 課程無到課率彙總欄位
		makeup: 0 // P2: 課程無補課名額欄位
	};
}

export interface ClassesData {
	classes: ClassRow[];
	coaches: Coach[];
}
export const getClasses = async (): Promise<ClassesData> => {
	const [apiCourses, apiCoaches] = await Promise.all([listCourses(), listCoaches()]);
	const coaches = apiCoaches.map(mapCoach);
	const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));
	return {
		classes: apiCourses.map((c) => mapCourse(c, coachNameById)),
		coaches
	};
};

/* ── 課程建立/編輯（POST /courses、PATCH /courses/{id}，admin-only，Task 8 piece 1） ──
 * Body 形狀對齊 CreateCourseRequest/UpdateCourseRequest（契約 §3.3）；兩個端點的欄位
 * 全部選填語意不同（POST 有 4 個實質必填、PATCH 全選填一律「省略＝維持原值」），這裡
 * 用同一個寬鬆型別給兩支函式共用（呼叫端 course-request.ts 的 buildCourseBody() 負責
 * 組出實際會送出的欄位），不為了型別層面的必填/選填強分兩型別。 */
export interface CourseWriteBody {
	name?: string;
	slug?: string;
	level?: string;
	description?: string;
	duration_minutes?: number;
	price_cents?: number;
	max_students?: number;
	min_age?: number;
	max_age?: number;
	features?: string[];
	coach_id?: string;
	category?: string;
	schedule_text?: string;
	is_highlighted?: boolean;
}

export const createCourse = (body: CourseWriteBody): Promise<ApiCourse> =>
	api<ApiCourse>('/courses', { method: 'POST', body: JSON.stringify(body) });

export const updateCourse = (id: string, body: CourseWriteBody): Promise<ApiCourse> =>
	api<ApiCourse>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/* ═════════════════════════ 教練（GET /coaches，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** `CoachResponse` 現帶 `name`(教練真實姓名)與 `title`(職稱)，兩者分開映射(同
 *  public/adapters.ts 的 toMarketingCoach，見 integration-contract.md §3.4)。
 *  phone/status/年資/學員/班級/獲獎統計欄位仍無對應，一律誠實給預設值(P2：待
 *  後端補對應欄位或 join 出真實統計)。 */
function mapCoach(c: ApiCoach, i: number): Coach {
	return {
		id: c.id,
		name: c.name,
		initial: c.name.charAt(0) || '?',
		title: c.title,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length], // P2: 後端無代表色欄位
		tags: c.specialties,
		years: 0, // P2: 後端無年資數字欄位(experience 是自由文字，不硬猜解析)
		students: 0, // P2: 後端無學員數統計欄位
		awards: 0, // P2: 後端無獲獎數統計欄位
		classes: 0, // P2: 後端無授課班級數統計欄位
		status: 'offline', // P2: 後端無即時線上狀態欄位，一律預設離線
		phone: '' // P2: 後端無教練聯絡電話欄位
	};
}

export interface CoachesData {
	coaches: Coach[];
}
export const getCoaches = (): Promise<CoachesData> =>
	listCoaches().then((coaches) => ({ coaches: coaches.map(mapCoach) }));

/* ═════════════════════════ 學員（GET /users，admin-only） ═════════════════════════
 * GET /users 是通用帳號端點，跟 MembersTable 目前吃的完整 Member 型別(課程/教練/
 * 出席/繳費/緊急聯絡人…)落差很大 —— 這裡先提供「後端真實形狀進、7 個對應欄位出」
 * 的映射與 getter(見 data.ts 的 MemberAccount/mapMemberAccount)。學員管理頁尚未
 * 接上這支 getter(MembersTable 仍吃既有 mock，未在本次任務變動範圍)，此 seam
 * 供後續任務或頁面改版時直接使用。 */

interface ApiUserListResponse {
	users: ApiUserAccount[];
	total: number;
	page: number;
	per_page: number;
}

export interface MembersData {
	members: MemberAccount[];
}
export const getMembers = (): Promise<MembersData> =>
	api<ApiUserListResponse>('/users?per_page=100').then((r) => ({
		members: r.users.map(mapMemberAccount)
	}));

/* ═════════════════════════ 優惠碼（GET /coupons、POST /coupons，admin-only，Task 8 piece 3） ═════════════════════════
 * 後端只有「建立 + 列表」，沒有 update/delete 端點（issue #4 已註記，本輪刻意不開新
 * 端點）——對應頁面（routes/admin/coupons）只做列表 + 建立，不渲染編輯/刪除（同
 * MembersTable 對缺端點欄位的處理原則：沒有端點就誠實不做，不留假按鈕）。 */

export interface ApiCoupon {
	id: string;
	code: string;
	discount_cents: number;
	is_active: boolean;
	expires_at: string | null;
	created_at: string;
}

interface ApiCouponListResponse {
	coupons: ApiCoupon[];
	total: number;
	page: number;
	per_page: number;
}

/** discount 經 ntd() 換成 NT$；expiresAt 取日期前 10 碼（同其餘日期欄位慣例），
 *  null（永久有效）顯示 '—'。 */
export interface Coupon {
	id: string;
	code: string;
	discount: number;
	active: boolean;
	expiresAt: string;
}

function mapCoupon(c: ApiCoupon): Coupon {
	return {
		id: c.id,
		code: c.code,
		discount: ntd(c.discount_cents),
		active: c.is_active,
		expiresAt: c.expires_at ? c.expires_at.slice(0, 10) : '—'
	};
}

export interface CouponsData {
	coupons: Coupon[];
}
export const getCoupons = (): Promise<CouponsData> =>
	api<ApiCouponListResponse>('/coupons?per_page=100').then((r) => ({
		coupons: r.coupons.map(mapCoupon)
	}));

export interface CreateCouponBody {
	code: string;
	discount_cents: number;
	expires_at?: string;
}

export const createCoupon = (body: CreateCouponBody): Promise<ApiCoupon> =>
	api<ApiCoupon>('/coupons', { method: 'POST', body: JSON.stringify(body) });
