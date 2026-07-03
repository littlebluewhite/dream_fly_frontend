/* 管理後台 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import {
	TICKETS,
	CLASSES,
	COACHES,
	VENUES,
	ORDERS,
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
import type {
	Ticket,
	ClassRow,
	Coach,
	Venue,
	Order,
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
	WeekdayLoad
} from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 教練清單單一內部存取點;未來 fetch 只改此處。 */
const coaches = (): Coach[] => COACHES;

export interface VenuesData { venues: Venue[] }
export const getVenues = (): Promise<VenuesData> => reply({ venues: VENUES });

export interface TicketsData { tickets: Ticket[] }
export const getTickets = (): Promise<TicketsData> => reply({ tickets: TICKETS });

export interface OrdersData { orders: Order[] }
export const getOrders = (): Promise<OrdersData> => reply({ orders: ORDERS });

/** 報表分析整包:KPI 帶 + 15 個圖表元件消費的全部資料集(換後端只改這一層)。 */
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

export interface ClassesData { classes: ClassRow[]; coaches: Coach[] }
export const getClasses = (): Promise<ClassesData> => reply({ classes: CLASSES, coaches: coaches() });

export interface CoachesData { coaches: Coach[] }
export const getCoaches = (): Promise<CoachesData> => reply({ coaches: coaches() });
