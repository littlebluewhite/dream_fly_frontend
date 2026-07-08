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
import { ageRange, initialOf, pageMeta } from '$lib/api/wire';
import type { ApiPage } from '$lib/api/wire';
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
	ApiUserAccount
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
}
interface ApiAdminReports {
	revenue: {
		this_month_cents: number;
		last_month_cents: number;
		trend: ApiAdminRevenueTrendPoint[];
	};
	members: { total: number; new_this_month: number; active: number };
	courses: ApiAdminReportsCourse[];
	coaches: ApiAdminReportsCoach[];
}

/** courses[]/coaches[] 的 UI 形狀——`fillRate` 維持契約的 0–1 比例(null 只在
 *  max_students=0 的防禦性情境出現，見裁決 4)，由頁面用 fmtPct() 格式化，不在此層
 *  轉成百分比字串(cents→dollar 才是 ntd() 的職責，比例不是金額)。 */
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
}

/** 報表分析頁消費的全部資料——Task 15 起改吃 GET /reports/admin 的四組真實彙總。
 *  舊 mock 的 kpis/revenueBreakdown/revenueTotal/categorySplit/topCourses/
 *  incomeSources/coachPerf/venueUsage/attDist/retention/ageDist/tierDist/
 *  campusRevenue/paymentSplit/funnel/weekdayLoad 皆無對應後端資料源(見契約 §3.24
 *  「mock 有但契約無」清單)，已隨對應圖表/卡片區塊一併移除(裁決 9)，不留假數字。 */
export interface ReportsData {
	revenue: {
		thisMonth: number; // ntd(this_month_cents)
		lastMonth: number; // ntd(last_month_cents)
		trend: TrendBar[]; // 12 筆，舊到新；h 為 ntd() 後的當月營收
	};
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
	return { id: c.coach_id, name: c.name, courseCount: c.course_count, studentCount: c.student_count };
}

/** GET /reports/admin — 單一物件回應，不分頁(裁決 1)。trend 固定 12 筆、舊到新、
 *  缺資料月份已由後端補 0(裁決 2)；`m` 直接沿用後端 "YYYY-MM"(12 個月可能跨兩個
 *  日曆年，不裁成純「N月」以免年份混淆)；不設 peak——契約沒有「最高月份」欄位，
 *  不無中生有標記，讓 RevenueTrend 的長條維持單一主色。空庫時 revenue 全 0、
 *  members 全 0、courses/coaches 皆 []，此處原樣穿透(裁決文末「空庫」段落)。 */
export const getReports = (): Promise<ReportsData> =>
	api<ApiAdminReports>('/reports/admin').then((r) => ({
		revenue: {
			thisMonth: ntd(r.revenue.this_month_cents),
			lastMonth: ntd(r.revenue.last_month_cents),
			trend: r.revenue.trend.map((t) => ({ m: t.month, h: ntd(t.revenue_cents) }))
		},
		members: { total: r.members.total, newThisMonth: r.members.new_this_month, active: r.members.active },
		courses: r.courses.map(mapAdminReportCourse),
		coaches: r.coaches.map(mapAdminReportCoach)
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
