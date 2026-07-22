/* Dream Fly — 管理後台報表分析 API 接縫。C5（第八輪架構深化）自 admin/api.ts 拆出
 * 報表分析段（原 GET /reports/admin 型別/getReports/私有 mapper，見 integration-
 * contract.md §3.24），純 locality 整理、interface 完全不變；admin/api.ts 保留逐名
 * re-export，既有消費端零改動。 */
import { api } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';
import type { TrendBar } from './data';

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
