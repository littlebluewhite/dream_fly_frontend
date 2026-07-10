/* 管理後台 API 接縫。Task 18：venues/tickets/orders/classes/coaches 換真後端資料；
 * Task 15：getReports 換成真後端彙總資料（GET /reports/admin，見 integration-
 * contract.md §3.24）。回傳「形狀」盡量維持不變，頁面不用重寫樣板 —— 既有 Order/
 * ClassRow/Coach/Venue/Ticket 型別維持原樣，後端沒有對應的欄位一律給誠實預設值
 * （見各函式註解），呼叫端不用改。 */
import { api } from '$lib/api/client';
import { listCoaches, listVenues } from '$lib/public/api';
import type { ApiCourse, ApiCoach, ApiVenue, ApiProduct } from '$lib/public/api';
import { ntd, orderItemsSummary } from '$lib/public/adapters';
import { COURSE_LEVEL_LABEL } from '$lib/domain/course-level';
import { ageRange, initialOf, isoDateTime, pageMeta } from '$lib/api/wire';
import type { ApiPage, Tone } from '$lib/api/wire';
import { deriveSessionStatus } from '$lib/coach/api';
import type { TodayStatus } from '$lib/coach/data';
import { MEMBER_COLORS, mapMemberAccount } from './data';
import type {
	Ticket,
	TicketType,
	ClassRow,
	ClassStatus,
	Coach,
	Venue,
	Order,
	OrderStatus,
	TrendBar,
	MemberAccount,
	ApiUserAccount,
	TodayClass,
	Activity
} from './data';

/* ═════════════════════════ 場館（GET /venues，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** VenueResponse 沒有 type 欄位 —— features 語意上對應器材配置(equip)、is_active
 *  對應可預約狀態(status，下線視為維護中)；type 借用 description(後端沒有專門的
 *  「場地類型」欄位)。area/cap/今日排課(today) 是無後端來源的裝飾欄位，Task F4 已
 *  隨 VenueEditDialog/venues 頁欄位收斂一併移除(不留假數字)。 */
function mapVenue(v: ApiVenue): Venue {
	return {
		id: v.id,
		slug: v.slug,
		name: v.name,
		type: v.description ?? '', // 後端沒有專門的「場地類型」欄位，借用 description
		equip: v.features,
		status: v.is_active ? 'available' : 'maintenance'
	};
}

export interface VenuesData {
	venues: Venue[];
}
export const getVenues = (): Promise<VenuesData> =>
	listVenues().then((venues) => ({ venues: venues.map(mapVenue) }));

/* ── 場館建立與編輯(POST /venues、PATCH /venues/{id}，admin-only，Task F4) ──
 * Body 形狀對齊 integration-contract.md §3.5；PATCH 全欄位選填(省略＝維持原值，
 * category_id/description/image_url 可明確傳 null 清空)。呼叫端(venues/+page.svelte)
 * 目前只開放編輯 name/description/features/is_active 這四個欄位(見 VenueEditDialog
 * 欄位收斂)，category_id/image_url/slug 沒有對應 UI，寫入時一律不帶(省略＝維持原值)
 * ——slug 由後端依名稱自動產生，前端固定唯讀顯示(見 VenueEditDialog 註解)。 */
export interface VenueWriteBody {
	name?: string;
	slug?: string;
	category_id?: string | null;
	description?: string | null;
	features?: string[];
	image_url?: string | null;
	is_active?: boolean;
}

export const createVenue = (body: VenueWriteBody): Promise<ApiVenue> =>
	api<ApiVenue>('/venues', { method: 'POST', body: JSON.stringify(body) });

export const updateVenue = (id: string, body: VenueWriteBody): Promise<ApiVenue> =>
	api<ApiVenue>(`/venues/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/* ═════════════════════════ 票券（GET /products，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** 後端 product_type 三值（ticket|membership|course_package，merchandise 已被
 *  getTickets() 濾除，不會流到這裡）現與前端 TicketType 一一對應（Task F1 收斂）——
 *  不再折疊成 pass/trial/event 這組無後端來源的虛構分組。讀寫共用同一份真值：
 *  createProduct/updateProduct 的 body 把 Ticket.type 原樣送回 product_type，不需要
 *  中介對照表。 */

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
		type: p.product_type as TicketType,
		price: ntd(p.price_cents),
		sold: p.sold,
		quota: p.quota,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		icon: 'ticket',
		desc: p.description ?? ''
	};
}

type ApiProductListResponse = ApiPage<'products', ApiProduct>;

/** admin 專用分頁抓取（Task 17）——不假道 public listProducts()：那支固定
 *  per_page=100，是行銷頁一次拉滿全量、前端篩選用的既有行為，不能動；這裡改走
 *  admin 自己的真實分頁請求，per_page 省略即吃後端預設 20。 */
const listProductsPaged = (page: number): Promise<ApiProductListResponse> =>
	api<ApiProductListResponse>(`/products?page=${page}`);

export interface TicketsData {
	tickets: Ticket[];
	/** GET /products 分頁 meta 穿透（Task 17）——total/perPage 是「全部商品」總數/
	 *  單頁筆數（含 merchandise），不是濾除 merchandise 後的票券數；PaginationBar
	 *  據此換頁，票券清單本身仍由本頁 products 濾除 merchandise 後產生。 */
	total: number;
	page: number;
	perPage: number;
}
export const getTickets = (page = 1): Promise<TicketsData> =>
	listProductsPaged(page).then((r) => ({
		tickets: r.products.filter((p) => p.product_type !== 'merchandise').map(mapProduct),
		...pageMeta(r)
	}));

/* ── 票券/方案建立與編輯(POST /products、PATCH /products/{id}，admin-only，Task F1) ──
 * Body 形狀對齊 CreateProductRequest/UpdateProductRequest(integration-contract.md
 * §3.7)；PATCH 全欄位選填(省略＝維持原值)。`stock` 是唯一可寫的庫存/配額欄位——
 * ProductResponse 的 `quota` 只是 `stock` 的唯讀鏡射(見上 mapProduct() 註解)，write
 * body 沒有獨立的 quota 欄位；呼叫端(tickets/+page.svelte)把表單的 quota 原值放進
 * stock 送出即可(null = 不限，同讀側語意)。product_type 讀寫共用同一組真實三值
 * (見上 mapProduct())，呼叫端直接把 Ticket.type 放進這裡，不需要另外轉換。 */
export interface ProductWriteBody {
	name?: string;
	slug?: string;
	product_type?: string;
	description?: string;
	price_cents?: number;
	original_price_cents?: number;
	features?: string[];
	is_highlighted?: boolean;
	badge?: string;
	stock?: number | null;
	valid_days?: number;
	session_count?: number;
}

export const createProduct = (body: ProductWriteBody): Promise<ApiProduct> =>
	api<ApiProduct>('/products', { method: 'POST', body: JSON.stringify(body) });

export const updateProduct = (id: string, body: ProductWriteBody): Promise<ApiProduct> =>
	api<ApiProduct>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

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
type ApiAdminOrderListResponse = ApiPage<'orders', ApiAdminOrder>;

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
		initial: initialOf(o.user_name),
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
	/** GET /orders 分頁 meta 穿透（Task 17）——PaginationBar 據此換頁。 */
	total: number;
	page: number;
	perPage: number;
}
export const getOrders = (page = 1): Promise<OrdersData> =>
	api<ApiAdminOrderListResponse>(`/orders?page=${page}`).then((r) => ({
		orders: r.orders.map(mapAdminOrder),
		...pageMeta(r)
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

/* ═════════════════════════ 報表分析（GET /reports/admin，admin-only，見 integration-contract.md §3.24） ═════════════════════════ */

interface ApiAdminRevenueTrendPoint {
	month: string; // "YYYY-MM"
	revenue_cents: number;
}
interface ApiAdminReportsCourse {
	course_id: string;
	name: string;
	enrolled: number;
	max_students: number;
	fill_rate: number | null;
	waitlist_count: number;
}
interface ApiAdminReportsCoach {
	coach_id: string;
	name: string;
	course_count: number;
	student_count: number;
	revenue_cents_12m: number;
	attendance_rate: number | null;
}

/** revenue_breakdown/income_sources_12m 固定 6 桶 canonical 序；category_split 少
 *  venue_rental(場租非 order line)只剩 5 桶(契約 §3.24 裁決)。這組字串 wire→FE 原樣
 *  穿透、不重新命名，故 wire/FE 兩層共用同一組型別(同 data.ts 的 OrderStatus 慣例)。 */
export type AdminRevenueSource = 'course' | 'ticket' | 'membership' | 'course_package' | 'merchandise' | 'venue_rental';
export type AdminCategorySource = Exclude<AdminRevenueSource, 'venue_rental'>;

/** attendance_distribution/age_distribution/tier_distribution 的固定桶 key——同樣
 *  wire→FE 原樣穿透；中文標籤/色查表在 report-math.ts(頁面消費時才查，這裡只負責
 *  型別正確)。 */
export type AdminAttendanceBucket = 'gte_95' | '85_94' | '75_84' | 'lt_75';
export type AdminAgeBucket = '0-6' | '7-12' | '13-17' | '18-25' | '26-40' | '41+';
export type AdminTierBucket = 'regular' | 'bronze' | 'silver' | 'gold';

interface ApiAdminKpiPair {
	this_month: number;
	last_month: number;
}
interface ApiAdminAttendanceKpiPair {
	this_month: number | null;
	last_month: number | null;
}
interface ApiAdminKpis {
	new_members: ApiAdminKpiPair;
	new_enrolments: ApiAdminKpiPair;
	paid_orders_count: ApiAdminKpiPair;
	attendance_rate: ApiAdminAttendanceKpiPair;
}
interface ApiAdminRevenueBreakdownRow {
	source: AdminRevenueSource;
	gross_cents: number;
	orders_count: number;
	units: number;
}
interface ApiAdminIncomeSourceRow {
	month: string; // "YYYY-MM"
	source: AdminRevenueSource;
	gross_cents: number;
	orders_count: number;
	units: number;
}
interface ApiAdminCategorySplitRow {
	source: AdminCategorySource;
	gross_cents: number;
	ratio: number | null;
}
interface ApiAdminPaymentSplitRow {
	method: string; // 應用層自由字串(非 DB enum)；NULL 已由後端轉 "unknown"
	count: number;
}
interface ApiAdminAttendanceDistRow {
	bucket: AdminAttendanceBucket;
	count: number;
}
interface ApiAdminAgeDistRow {
	bucket: AdminAgeBucket;
	count: number;
}
interface ApiAdminTierDistRow {
	bucket: AdminTierBucket;
	count: number;
}
interface ApiAdminRetentionRow {
	month: string; // "YYYY-MM"
	new_count: number;
	returning_count: number;
	rate: number | null;
}
interface ApiAdminFunnel {
	trial_inquiries: number;
	new_enrolments: number;
}
interface ApiAdminWeekdayLoadRow {
	weekday: number; // 0=週日..6=週六
	present_count: number;
}
interface ApiAdminVenueUsageRow {
	venue: string;
	minutes: number;
}
interface ApiAdminReports {
	revenue: {
		this_month_cents: number;
		last_month_cents: number;
		trend: ApiAdminRevenueTrendPoint[];
	};
	kpis: ApiAdminKpis;
	revenue_breakdown: ApiAdminRevenueBreakdownRow[];
	income_sources_12m: ApiAdminIncomeSourceRow[];
	category_split: ApiAdminCategorySplitRow[];
	payment_split: ApiAdminPaymentSplitRow[];
	attendance_distribution: ApiAdminAttendanceDistRow[];
	age_distribution: ApiAdminAgeDistRow[];
	tier_distribution: ApiAdminTierDistRow[];
	retention: ApiAdminRetentionRow[];
	funnel: ApiAdminFunnel;
	weekday_load: ApiAdminWeekdayLoadRow[];
	venue_usage: ApiAdminVenueUsageRow[];
	members: { total: number; new_this_month: number; active: number };
	courses: ApiAdminReportsCourse[];
	coaches: ApiAdminReportsCoach[];
}

/** courses[]/coaches[] 的 UI 形狀——`fillRate`/`attendanceRate` 維持契約的 0–1 比例
 *  (null 為防禦性情境：courses 見裁決 4／coaches 見裁決「無資料 → null」)，由頁面
 *  用 fmtPct() 格式化；`revenueCents12m` 維持 cents number(命名 *Cents)，顯示層才
 *  ntd() 換算成 NT$ 字串——皆不在此層轉成格式化字串(cents→dollar 才是 ntd() 的
 *  職責，比例不是金額)。 */
export interface AdminReportCourseRow {
	id: string;
	name: string;
	enrolled: number;
	maxStudents: number;
	fillRate: number | null;
	waitlistCount: number;
}
export interface AdminReportCoachRow {
	id: string;
	name: string;
	courseCount: number;
	studentCount: number;
	revenueCents12m: number;
	attendanceRate: number | null;
}

/** kpis 四組 this/last studio-月對——環比 % 由前端算(見 report-math.ts 的
 *  deltaPct())，此層只原樣穿透兩個月份的原始數值/比例；attendanceRate 兩欄可能為
 *  null(無出勤資料的月份)。 */
export interface AdminReportKpis {
	newMembers: { thisMonth: number; lastMonth: number };
	newEnrolments: { thisMonth: number; lastMonth: number };
	paidOrdersCount: { thisMonth: number; lastMonth: number };
	attendanceRate: { thisMonth: number | null; lastMonth: number | null };
}

export interface AdminRevenueBreakdownRow {
	source: AdminRevenueSource;
	grossCents: number;
	ordersCount: number;
	units: number;
}
export interface AdminIncomeSourceRow {
	month: string;
	source: AdminRevenueSource;
	grossCents: number;
	ordersCount: number;
	units: number;
}
/** ratio 為 0–1、分母(五桶合計)為 0 → null，由頁面 fmtPct() 格式化；不含
 *  venue_rental(場租非 order line)。 */
export interface AdminCategorySplitRow {
	source: AdminCategorySource;
	grossCents: number;
	ratio: number | null;
}
/** method 為應用層自由字串、非固定桶(零筆的付款方式不出列)；占比/環比由前端算
 *  (見 report-math.ts 的 pctShares()/deltaPct())。 */
export interface AdminPaymentSplitRow {
	method: string;
	count: number;
}
export interface AdminAttendanceDistRow {
	bucket: AdminAttendanceBucket;
	count: number;
}
export interface AdminAgeDistRow {
	bucket: AdminAgeBucket;
	count: number;
}
export interface AdminTierDistRow {
	bucket: AdminTierBucket;
	count: number;
}
/** rate 為「|上月活躍∩本月活躍| / |上月活躍|」，上月為空集合 → null。 */
export interface AdminRetentionRow {
	month: string;
	newCount: number;
	returningCount: number;
	rate: number | null;
}
export interface AdminFunnel {
	trialInquiries: number;
	newEnrolments: number;
}
export interface AdminWeekdayLoadRow {
	weekday: number; // 0=週日..6=週六
	presentCount: number;
}
export interface AdminVenueUsageRow {
	venue: string;
	minutes: number;
}

/** 報表分析頁消費的全部資料——Task 15 起改吃 GET /reports/admin；Round 4 Phase 4
 *  (Task P4-F1)隨後端 P4-B4a(金流)/P4-B4b(人流)兩批擴充，補上 kpis～venueUsage
 *  十二組彙總，以及 coaches[] 的 revenueCents12m/attendanceRate 兩欄——皆為契約
 *  §3.24 有對應資料源的真實彙總(見契約「mock 有但契約無」清單，Round 4 後僅剩
 *  campusRevenue/topCourses.rank/coachPerf.revPct 三項無資料源)。topCourses 不在
 *  此型別——由 report-math.ts 的 topCoursesFrom() 對 courses[] 純函式推導(裁決:
 *  免後端另開聚合端點)，頁面(P4-F2)消費時才呼叫，不落地成獨立欄位。 */
export interface ReportsData {
	revenue: {
		thisMonth: number; // ntd(this_month_cents)
		lastMonth: number; // ntd(last_month_cents)
		trend: TrendBar[]; // 12 筆，舊到新；h 為 ntd() 後的當月營收
	};
	kpis: AdminReportKpis;
	revenueBreakdown: AdminRevenueBreakdownRow[];
	incomeSources12m: AdminIncomeSourceRow[];
	categorySplit: AdminCategorySplitRow[];
	paymentSplit: AdminPaymentSplitRow[];
	attendanceDistribution: AdminAttendanceDistRow[];
	ageDistribution: AdminAgeDistRow[];
	tierDistribution: AdminTierDistRow[];
	retention: AdminRetentionRow[];
	funnel: AdminFunnel;
	weekdayLoad: AdminWeekdayLoadRow[];
	venueUsage: AdminVenueUsageRow[];
	members: { total: number; newThisMonth: number; active: number };
	courses: AdminReportCourseRow[];
	coaches: AdminReportCoachRow[];
}

function mapAdminReportCourse(c: ApiAdminReportsCourse): AdminReportCourseRow {
	return {
		id: c.course_id,
		name: c.name,
		enrolled: c.enrolled,
		maxStudents: c.max_students,
		fillRate: c.fill_rate,
		waitlistCount: c.waitlist_count
	};
}

function mapAdminReportCoach(c: ApiAdminReportsCoach): AdminReportCoachRow {
	return {
		id: c.coach_id,
		name: c.name,
		courseCount: c.course_count,
		studentCount: c.student_count,
		revenueCents12m: c.revenue_cents_12m,
		attendanceRate: c.attendance_rate
	};
}

function mapAdminKpis(k: ApiAdminKpis): AdminReportKpis {
	return {
		newMembers: { thisMonth: k.new_members.this_month, lastMonth: k.new_members.last_month },
		newEnrolments: { thisMonth: k.new_enrolments.this_month, lastMonth: k.new_enrolments.last_month },
		paidOrdersCount: { thisMonth: k.paid_orders_count.this_month, lastMonth: k.paid_orders_count.last_month },
		attendanceRate: { thisMonth: k.attendance_rate.this_month, lastMonth: k.attendance_rate.last_month }
	};
}

const mapRevenueBreakdownRow = (r: ApiAdminRevenueBreakdownRow): AdminRevenueBreakdownRow => ({
	source: r.source,
	grossCents: r.gross_cents,
	ordersCount: r.orders_count,
	units: r.units
});

const mapIncomeSourceRow = (r: ApiAdminIncomeSourceRow): AdminIncomeSourceRow => ({
	month: r.month,
	source: r.source,
	grossCents: r.gross_cents,
	ordersCount: r.orders_count,
	units: r.units
});

const mapCategorySplitRow = (r: ApiAdminCategorySplitRow): AdminCategorySplitRow => ({
	source: r.source,
	grossCents: r.gross_cents,
	ratio: r.ratio
});

const mapRetentionRow = (r: ApiAdminRetentionRow): AdminRetentionRow => ({
	month: r.month,
	newCount: r.new_count,
	returningCount: r.returning_count,
	rate: r.rate
});

/** GET /reports/admin — 單一物件回應，不分頁(裁決 1)。trend 固定 12 筆、舊到新、
 *  缺資料月份已由後端補 0(裁決 2)；`m` 直接沿用後端 "YYYY-MM"(12 個月可能跨兩個
 *  日曆年，不裁成純「N月」以免年份混淆)；不設 peak——契約沒有「最高月份」欄位，
 *  不無中生有標記，讓 RevenueTrend 的長條維持單一主色。Round 4 P4-F1 新增的 12 組
 *  金流/人流彙總與 coaches[] 兩新欄一律 snake_case→camelCase、cents 保持 number
 *  (顯示層才 ntd())、ratio/rate 0–1 穿透(null 保留 null)、月份字串原樣；環比一律
 *  前端算(不期待後端給，見 report-math.ts 的 deltaPct())。空庫時 revenue 全 0、
 *  members 全 0、courses/coaches/payment_split/venue_usage 皆 []，固定桶各段零填
 *  其固定桶數，此處原樣穿透(裁決文末「空庫」段落)。 */
export const getReports = (): Promise<ReportsData> =>
	api<ApiAdminReports>('/reports/admin').then((r) => ({
		revenue: {
			thisMonth: ntd(r.revenue.this_month_cents),
			lastMonth: ntd(r.revenue.last_month_cents),
			trend: r.revenue.trend.map((t) => ({ m: t.month, h: ntd(t.revenue_cents) }))
		},
		kpis: mapAdminKpis(r.kpis),
		revenueBreakdown: r.revenue_breakdown.map(mapRevenueBreakdownRow),
		incomeSources12m: r.income_sources_12m.map(mapIncomeSourceRow),
		categorySplit: r.category_split.map(mapCategorySplitRow),
		paymentSplit: r.payment_split.map((p) => ({ method: p.method, count: p.count })),
		attendanceDistribution: r.attendance_distribution.map((a) => ({ bucket: a.bucket, count: a.count })),
		ageDistribution: r.age_distribution.map((a) => ({ bucket: a.bucket, count: a.count })),
		tierDistribution: r.tier_distribution.map((t) => ({ bucket: t.bucket, count: t.count })),
		retention: r.retention.map(mapRetentionRow),
		funnel: { trialInquiries: r.funnel.trial_inquiries, newEnrolments: r.funnel.new_enrolments },
		weekdayLoad: r.weekday_load.map((w) => ({ weekday: w.weekday, presentCount: w.present_count })),
		venueUsage: r.venue_usage.map((v) => ({ venue: v.venue, minutes: v.minutes })),
		members: { total: r.members.total, newThisMonth: r.members.new_this_month, active: r.members.active },
		courses: r.courses.map(mapAdminReportCourse),
		coaches: r.coaches.map(mapAdminReportCoach)
	}));

/* ═════════════════════════ 今日課表（GET /sessions/today，admin 分支，見 integration-
 * contract.md §3.18，Task F11：admin 儀表板今日課表接真） ═════════════════════════ */

interface ApiAdminTodaySession {
	id: string;
	course_id: string;
	course_name: string;
	coach_name: string | null;
	start_time: string; // "HH:MM:SS"
	end_time: string;
	enrolled_count: number;
	venue: string | null;
}

/** 狀態 → [tone, label]（沿用桌面既有 TODAY mock 對這幾態的既有配色/文案慣例）。
 *  deriveSessionStatus(下方復用 coach/api.ts 既有實作，不重寫時間比較邏輯)依目前時間
 *  只會推導 wait/live/done 3 態，但其宣告的回傳型別 TodayStatus(coach/data.ts)是 4 值
 *  聯集——soon 是目前推導不到、但型別上合法的第 4 值。查表補齊 soon 分支(標籤/語意
 *  沿用 coach/data.ts CLASS_STATUS.soon 的「即將開始」暖色調)取代原本窄化到 3 態的
 *  cast，讓 state 能直接查表、不需要窄化 cast 掩蓋兩者落差——查表若真的漏了某個
 *  TodayStatus 值，現在是編譯期錯誤，不是等真資料哪天推導出第 4 態才在這裡
 *  destructure 到 undefined 而炸掉(TodayState(見 data.ts)另外多出的 prep(備課中)
 *  緩衝態不屬於 TodayStatus，這裡不涉及)。 */
const TODAY_TONE_LABEL: Record<TodayStatus, [Tone, string]> = {
	wait: ['neutral', '尚未開始'],
	live: ['success', '進行中'],
	done: ['neutral', '已結束'],
	soon: ['warning', '即將開始']
};

/** TodaySessionResponse(admin 分支)→ 既有 TodayClass 形狀。coach_name(Round 4 Task B8
 *  新增)為 null 表示課程尚未指定教練；venue(同批新增)為 null 表示場次反推不到對應
 *  slot——兩者皆顯示「—」。state 由 deriveSessionStatus 依目前時間推導，tone/label
 *  查上表。 */
function mapTodaySession(s: ApiAdminTodaySession, now: Date): TodayClass {
	const state = deriveSessionStatus(s.start_time, s.end_time, now);
	const [tone, label] = TODAY_TONE_LABEL[state];
	return {
		time: s.start_time.slice(0, 5),
		name: s.course_name,
		coach: s.coach_name ?? '—',
		room: s.venue ?? '—',
		count: s.enrolled_count,
		state,
		tone,
		label
	};
}

export interface TodaySessionsData {
	sessions: TodayClass[];
}

/** GET /sessions/today——admin 分支回全站當日場次，後端已依 start_time 排序。 */
export const getTodaySessions = async (): Promise<TodaySessionsData> => {
	const sessions = await api<ApiAdminTodaySession[]>('/sessions/today');
	const now = new Date();
	return { sessions: sessions.map((s) => mapTodaySession(s, now)) };
};

/* ═════════════════════════ 最新動態（GET /reports/admin/activity，見 integration-
 * contract.md §3.24，Task F11：admin 儀表板最新動態接真） ═════════════════════════ */

interface ApiAdminActivityItem {
	kind: 'user' | 'order' | 'enrolment' | 'inquiry';
	label: string;
	occurred_at: string;
}
interface ApiAdminActivityResponse {
	items: ApiAdminActivityItem[];
}

/** kind → icon/tone/bg 對照(前端配置——後端只給 kind，不含圖示資訊，見契約裁決「kind
 *  供前端配對應圖示，不做其他語意保證」)。沿用既有 Icon 註冊集與 Activity 既有
 *  tone(CSS 變數字串，非 Badge Tone)/bg 慣例。 */
const ACTIVITY_KIND_ICON: Record<ApiAdminActivityItem['kind'], { icon: string; tone: string; bg: string }> = {
	user: { icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)' },
	order: { icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)' },
	enrolment: { icon: 'book-open', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)' },
	inquiry: { icon: 'message-circle', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)' }
};

/** ActivityItem → 既有 Activity 形狀。label 已是後端組好的繁中人讀字串(含 NT$ 金額)，
 *  原樣穿透為 text；occurred_at(ISO8601)轉為顯示用 "YYYY-MM-DD HH:MM"(同 mapCoach.
 *  lastLogin 的 isoDateTime 慣例，這裡沒有既有的相對時間("N 分鐘前")格式化工具，不
 *  另外發明一套)。 */
function mapActivityItem(item: ApiAdminActivityItem): Activity {
	const { icon, tone, bg } = ACTIVITY_KIND_ICON[item.kind];
	return { icon, tone, bg, text: item.label, time: isoDateTime(item.occurred_at) };
}

export interface RecentActivityData {
	activity: Activity[];
}

/** GET /reports/admin/activity——UNION 四來源(新會員/新付款訂單/新報名/新洽詢)最近
 *  20 筆倒序，`{ items: [...] }` 陣列包裝(裁決 6，本端點不是單一物件回應)。 */
export const getRecentActivity = (): Promise<RecentActivityData> =>
	api<ApiAdminActivityResponse>('/reports/admin/activity').then((r) => ({
		activity: r.items.map(mapActivityItem)
	}));

/* ═════════════════════════ 課程（GET /courses，公開端點，復用 Task 14 public seam） ═════════════════════════ */

/** `schedule_text` 實測格式為 "週二、四 16:00-17:00"（day-part 與 time-part 以第
 *  一個空白分隔）；null 或找不到空白時，day 保留原字串（找不到空白）或空字串
 *  （null），time 一律給空字串。 */
function splitSchedule(text: string | null): { day: string; time: string } {
	if (!text) return { day: '', time: '' };
	const sp = text.indexOf(' ');
	return sp === -1 ? { day: text, time: '' } : { day: text.slice(0, sp), time: text.slice(sp + 1) };
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
 *  ——該表現在存的是 mapCoach() 輸出的真實 name)；level 經 $lib/domain/course-level
 *  的共用 5 級對照常數轉繁中(FE#17：後端 course_level 現為 5 值，這裡不再是舊
 *  3→5 折疊)；duration_minutes 直接映射為 durationMinutes(FE#18)；room/term/
 *  sessions/startDate/checkinRate/makeup 後端無對應欄位，誠實給預設值(P2)。 */
export function mapCourse(c: ApiCourse, coachNameById: Map<string, string>): ClassRow {
	const { day, time } = splitSchedule(c.schedule_text);
	return {
		id: c.id,
		name: c.name,
		level: COURSE_LEVEL_LABEL[c.level] ?? '基礎',
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
		makeup: 0, // P2: 課程無補課名額欄位
		durationMinutes: c.duration_minutes
	};
}

type ApiCourseListResponse = ApiPage<'courses', ApiCourse>;

/** admin 專用分頁抓取（Task 17）——不假道 public listCourses()：那支固定
 *  per_page=100，是行銷頁一次拉滿全量、前端篩選用的既有行為，不能動；這裡改走
 *  admin 自己的真實分頁請求，per_page 省略即吃後端預設 20。 */
const listCoursesPaged = (page: number): Promise<ApiCourseListResponse> =>
	api<ApiCourseListResponse>(`/courses?page=${page}`);

export interface ClassesData {
	classes: ClassRow[];
	coaches: Coach[];
	/** GET /courses 分頁 meta 穿透（Task 17）——PaginationBar 據此換頁。 */
	total: number;
	page: number;
	perPage: number;
}
export const getClasses = async (page = 1): Promise<ClassesData> => {
	const [coursesRes, apiCoaches] = await Promise.all([listCoursesPaged(page), listCoaches()]);
	const coaches = apiCoaches.map(mapCoach);
	const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));
	return {
		classes: coursesRes.courses.map((c) => mapCourse(c, coachNameById)),
		coaches,
		...pageMeta(coursesRes)
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
 *  Task F5 欄位收斂：`userId` 帶 `user_id`（CoachEditDialog 編輯姓名時要用這個呼叫
 *  PATCH /users/{user_id}，coaches 表本身沒有 name 欄位）；`isActive` 直接映射
 *  `is_active`——這個旗標實際控制 GET /coaches 的 `WHERE is_active = true` 過濾（見
 *  後端 coaches/repository.rs find_all_active()），也就是公開教練頁 /coaches 與課程頁
 *  的教練列表看不看得到這位教練，不是什麼線上/忙碌/離線的即時狀態裝飾。
 *  phone/年資/學員/班級/獲獎統計欄位已隨欄位收斂移除(P2：無後端來源；
 *  classes/students 有真實來源——見 getReports() 的 AdminReportCoachRow，屬於
 *  唯讀彙總，不是這裡或表單該手填的數字)。 */
function mapCoach(c: ApiCoach, i: number): Coach {
	return {
		id: c.id,
		userId: c.user_id,
		name: c.name,
		initial: initialOf(c.name),
		title: c.title,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length], // P2: 後端無代表色欄位，純視覺裝飾
		tags: c.specialties,
		isActive: c.is_active
	};
}

export interface CoachesData {
	coaches: Coach[];
}
export const getCoaches = (): Promise<CoachesData> =>
	listCoaches().then((coaches) => ({ coaches: coaches.map(mapCoach) }));

/* ── 教練建立與編輯(POST /coaches、PATCH /coaches/{id}，admin-only，Task F5) ──
 * Body 形狀對齊 integration-contract.md §3.4。姓名不在這裡——coaches 表本身沒有
 * name 欄位，改名一律走 createMember/updateMember 對應的 PATCH /users/{user_id}
 * （見 CoachFormValues 註解）。新增教練的產品流程是「先建 user 帳號、再綁 coach」
 * 兩步：後端沒有複合端點，呼叫端(routes/admin/coaches/+page.svelte)先呼叫
 * createMember() 拿 user_id，成功後才呼叫這裡的 createCoach()。PATCH 全欄位皆選填
 * (省略＝維持原值，同 VenueWriteBody/ProductWriteBody 的寬鬆單一型別給兩支函式共用
 * 慣例)。 */
export interface CoachWriteBody {
	user_id?: string;
	title?: string;
	bio?: string | null;
	experience?: string | null;
	specialties?: string[];
	certifications?: string[];
	display_order?: number;
	slug?: string | null;
	photo_url?: string | null;
	is_active?: boolean;
}

export const createCoach = (body: CoachWriteBody): Promise<ApiCoach> =>
	api<ApiCoach>('/coaches', { method: 'POST', body: JSON.stringify(body) });

export const updateCoach = (id: string, body: CoachWriteBody): Promise<ApiCoach> =>
	api<ApiCoach>(`/coaches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/* ═════════════════════════ 學員（GET /users，admin-only） ═════════════════════════
 * GET /users 是通用帳號端點，跟 MembersTable 完整 Member 型別(課程/教練/出席/繳費/
 * 緊急聯絡人…)落差很大 —— 這裡提供「後端真實形狀進、7 個對應欄位出」的映射與 getter
 * (見 data.ts 的 MemberAccount/mapMemberAccount)。學員管理頁(routes/admin/members/
 * +page.svelte)與首頁概覽卡(routes/admin/+page.svelte)皆已接上這支 getter(Task 5)。 */

type ApiUserListResponse = ApiPage<'users', ApiUserAccount>;

export interface MembersData {
	members: MemberAccount[];
	/** GET /users 分頁 meta 穿透（Task 17）——PaginationBar 據此換頁。 */
	total: number;
	page: number;
	perPage: number;
}
export const getMembers = (page = 1): Promise<MembersData> =>
	api<ApiUserListResponse>(`/users?page=${page}`).then((r) => ({
		members: r.users.map(mapMemberAccount),
		...pageMeta(r)
	}));

/* ── 學員新增/編輯（POST /users、PATCH /users/{id}，admin-only，Task 16） ──
 * 契約 §3.2：POST /users 不可自訂 roles（後端一律指派 member）；PATCH /users/{id}
 * 不可改 email/roles/password（v1 範圍外，body 帶了也會被忽略）——所以這兩支的 body
 * 型別分別只含各自端點真正接受的欄位。兩者回應皆為 UserResponse，一律經
 * mapMemberAccount() 映射回 MemberAccount，與 getMembers() 的形狀一致，呼叫端
 * （members/+page.svelte）不用另外處理兩種形狀。全欄位皆選填的 PATCH body（呼叫端
 * 傳 {}）就原樣送出，不在此層攔截——「至少提供一個欄位」422 由後端判斷，seam 只負責
 * 忠實傳遞與回傳/拋出。 */
export interface CreateMemberBody {
	email: string;
	name: string;
	phone?: string;
	password: string;
	/** 生日(Round 4 Task P4-F4；integration-contract.md §3.2)——選填，YYYY-MM-DD，
	 *  範圍 1900-01-01 至今天。留白省略(undefined)，不是清空語意——POST /users
	 *  沒有既有值可清，只有「填或不填」。 */
	birth_date?: string;
}
export const createMember = (body: CreateMemberBody): Promise<MemberAccount> =>
	api<ApiUserAccount>('/users', { method: 'POST', body: JSON.stringify(body) }).then(mapMemberAccount);

export interface UpdateMemberBody {
	name?: string;
	phone?: string;
	is_active?: boolean;
}
export const updateMember = (id: string, body: UpdateMemberBody): Promise<MemberAccount> =>
	api<ApiUserAccount>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(mapMemberAccount);

/* ═════════════════════════ 優惠碼（GET/POST/PATCH/DELETE /coupons，admin-only；
 * Task 8 piece 3 建立+列表，Task F6 補上編輯/停用/刪除） ═════════════════════════
 * 契約 §3.9：PATCH 不可改 code（對外發放的識別，不在 body 中）；DELETE 為硬刪除，
 * 語意上「停用」（is_active:false）才是主要路徑，DELETE 留給誤建且尚未被使用的
 * code（orders 只存 code 字串快照、無 FK，刪除不影響歷史訂單）——UI 對應把刪除放在
 * CouponCreateDialog 編輯模式最下方的危險區，需先經確認對話框（見
 * routes/admin/coupons/+page.svelte）才會真的送出；列表列的「編輯」「停用/啟用」
 * 則是一鍵直達的主要路徑，不需要確認。 */

export interface ApiCoupon {
	id: string;
	code: string;
	discount_cents: number;
	is_active: boolean;
	expires_at: string | null;
	created_at: string;
}

type ApiCouponListResponse = ApiPage<'coupons', ApiCoupon>;

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
	/** GET /coupons 分頁 meta 穿透（Task 17）——PaginationBar 據此換頁。 */
	total: number;
	page: number;
	perPage: number;
}
export const getCoupons = (page = 1): Promise<CouponsData> =>
	api<ApiCouponListResponse>(`/coupons?page=${page}`).then((r) => ({
		coupons: r.coupons.map(mapCoupon),
		...pageMeta(r)
	}));

export interface CreateCouponBody {
	code: string;
	discount_cents: number;
	expires_at?: string;
}

export const createCoupon = (body: CreateCouponBody): Promise<ApiCoupon> =>
	api<ApiCoupon>('/coupons', { method: 'POST', body: JSON.stringify(body) });

export interface UpdateCouponBody {
	discount_cents?: number;
	is_active?: boolean;
	expires_at?: string | null;
}

/** PATCH /coupons/{id}：discount_cents/is_active/expires_at 皆選填（省略＝維持原
 *  值），expires_at 明確傳 null 可把到期日清成永久有效。呼叫端（CouponCreateDialog
 *  編輯模式 + coupons/+page.svelte 的 buildUpdateCouponBody）一律全量送出這三欄，
 *  不利用「省略」語意——表單本來就持有完整的目前值，沒有「部分欄位」的中介狀態需要
 *  表達（同 MemberEditDialog/CoachEditDialog 的全量 resend 慣例）。 */
export const updateCoupon = (id: string, body: UpdateCouponBody): Promise<ApiCoupon> =>
	api<ApiCoupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

/** DELETE /coupons/{id} → 204 No Content（同 member/waitlist.ts cancelWaitlist 的
 *  DELETE 慣例，api() 對 204 回傳 undefined，見 client.ts）。硬刪除，語意見本節開頭
 *  註解——呼叫端必須先經過確認步驟才能呼叫這支。 */
export async function deleteCoupon(id: string): Promise<void> {
	await api(`/coupons/${id}`, { method: 'DELETE' });
}

/* ═════════════════════════ 系統設定（GET/PUT /settings，admin-only，見 integration-
 * contract.md §3.25，Task F9：系統設定頁接真） ═════════════════════════
 * 後端是最簡 key-value 全域表：key 自由字串、value 任意合法 JSON，完全不逐欄驗證
 * （見遷移檔 migrations/20260708000002_settings.sql 註解）。本輪前端只消費三個
 * 契約記錄的慣例 key —— studio_profile（場館名稱/電話/地址/預設師生比/每班人數
 * 上限）、notification_flags（email/sms/lowAtt/autoWait 四個布林）、security
 * （twoFA 布林）。「登入裝置清單」不在範圍（契約 §3.25 開頭：需 session 管理，
 * 另案處理，routes/admin/settings/+page.svelte 該區塊維持現狀）。
 *
 * value 內欄位大小寫逐字對齊契約 §3.25 裁決 4 的範例與後端 tests/http_settings.rs
 * 的既有事實——studio_profile 用 snake_case（default_ratio/max_class_size），
 * notification_flags/security 用 camelCase（lowAtt/autoWait/twoFA）；這不是本層
 * 自選風格，改成別的大小寫會跟後端測試資料對不上。
 *
 * 新裝機 GET /settings 回 `{ settings: {} }`（migration 不灌任何預設列）——三個
 * 慣例 key 皆可能整個缺席，也可能只有部分子欄位；mapXxx() 逐欄位以 DEFAULT_*
 * 常數補值，讓呼叫端永遠拿到填滿的表單初值，不必自己判斷「這欄後端到底有沒有
 * 給」。 */

interface ApiStudioProfile {
	name?: string;
	phone?: string;
	address?: string;
	default_ratio?: string;
	max_class_size?: number;
}
interface ApiNotificationFlags {
	email?: boolean;
	sms?: boolean;
	lowAtt?: boolean;
	autoWait?: boolean;
}
interface ApiSecuritySettings {
	twoFA?: boolean;
}
interface ApiSettingsResponse {
	settings: {
		studio_profile?: ApiStudioProfile;
		notification_flags?: ApiNotificationFlags;
		security?: ApiSecuritySettings;
	};
}

export interface StudioProfile {
	name: string;
	phone: string;
	address: string;
	defaultRatio: string;
	maxClassSize: number;
}
export interface NotificationFlags {
	email: boolean;
	sms: boolean;
	lowAtt: boolean;
	autoWait: boolean;
}
export interface SecuritySettings {
	twoFA: boolean;
}

const DEFAULT_STUDIO_PROFILE: StudioProfile = {
	name: 'Dream Fly 夢飛體操館',
	phone: '04-2376-1688',
	address: '台中市西區美村路一段 168 號',
	defaultRatio: '1:6',
	maxClassSize: 12
};
const DEFAULT_NOTIFICATION_FLAGS: NotificationFlags = {
	email: true,
	sms: false,
	lowAtt: true,
	autoWait: true
};
const DEFAULT_SECURITY_SETTINGS: SecuritySettings = { twoFA: true };

function mapStudioProfile(raw?: ApiStudioProfile): StudioProfile {
	return {
		name: raw?.name ?? DEFAULT_STUDIO_PROFILE.name,
		phone: raw?.phone ?? DEFAULT_STUDIO_PROFILE.phone,
		address: raw?.address ?? DEFAULT_STUDIO_PROFILE.address,
		defaultRatio: raw?.default_ratio ?? DEFAULT_STUDIO_PROFILE.defaultRatio,
		maxClassSize: raw?.max_class_size ?? DEFAULT_STUDIO_PROFILE.maxClassSize
	};
}
function mapNotificationFlags(raw?: ApiNotificationFlags): NotificationFlags {
	return {
		email: raw?.email ?? DEFAULT_NOTIFICATION_FLAGS.email,
		sms: raw?.sms ?? DEFAULT_NOTIFICATION_FLAGS.sms,
		lowAtt: raw?.lowAtt ?? DEFAULT_NOTIFICATION_FLAGS.lowAtt,
		autoWait: raw?.autoWait ?? DEFAULT_NOTIFICATION_FLAGS.autoWait
	};
}
function mapSecuritySettings(raw?: ApiSecuritySettings): SecuritySettings {
	return { twoFA: raw?.twoFA ?? DEFAULT_SECURITY_SETTINGS.twoFA };
}

export interface SettingsData {
	studioProfile: StudioProfile;
	notificationFlags: NotificationFlags;
	security: SecuritySettings;
}
function mapSettings(r: ApiSettingsResponse): SettingsData {
	const s = r.settings ?? {};
	return {
		studioProfile: mapStudioProfile(s.studio_profile),
		notificationFlags: mapNotificationFlags(s.notification_flags),
		security: mapSecuritySettings(s.security)
	};
}

export const getSettings = (): Promise<SettingsData> =>
	api<ApiSettingsResponse>('/settings').then(mapSettings);

/** PUT /settings body —— 三組皆選填（省略＝該 key 不 upsert，維持後端原值，契約
 *  §3.25 裁決 1；空物件整包送出視為 no-op，裁決 2）。呼叫端（routes/admin/settings/
 *  +page.svelte、mobile-admin AdminSettingsScreen.svelte）目前只有一個「儲存變更」
 *  動作、沒有逐卡片分開儲存的 UI，故一律全送三組（不追蹤「這次改了哪個 key」的
 *  dirty 狀態，報告已註明）。回應同 GET，經同一支 mapSettings() 映射回傳。 */
export interface SettingsWriteBody {
	studio_profile?: Partial<{
		name: string;
		phone: string;
		address: string;
		default_ratio: string;
		max_class_size: number;
	}>;
	notification_flags?: Partial<NotificationFlags>;
	security?: Partial<SecuritySettings>;
}
export const putSettings = (body: SettingsWriteBody): Promise<SettingsData> =>
	api<ApiSettingsResponse>('/settings', {
		method: 'PUT',
		body: JSON.stringify({ settings: body })
	}).then(mapSettings);
