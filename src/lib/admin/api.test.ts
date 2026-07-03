import { describe, it, expect } from 'vitest';
import { getVenues, getTickets, getOrders, getReports, getClasses, getCoaches } from './api';
import {
	VENUES,
	TICKETS,
	ORDERS,
	CLASSES,
	COACHES,
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

describe('admin/api', () => {
	it('getVenues 回傳整包場館資料', async () => {
		const d = await getVenues();
		expect(d).toEqual({ venues: VENUES });
	});
	it('getVenues 是 async 接縫(回 Promise)', () => {
		expect(getVenues()).toBeInstanceOf(Promise);
	});

	it('getTickets 回傳整包票券資料', async () => {
		const d = await getTickets();
		expect(d).toEqual({ tickets: TICKETS });
	});
	it('getTickets 是 async 接縫(回 Promise)', () => {
		expect(getTickets()).toBeInstanceOf(Promise);
	});

	it('getOrders 回傳整包訂單資料', async () => {
		const d = await getOrders();
		expect(d).toEqual({ orders: ORDERS });
	});
	it('getOrders 是 async 接縫(回 Promise)', () => {
		expect(getOrders()).toBeInstanceOf(Promise);
	});

	it('getReports 回傳整包報表資料(KPI 帶 + 全部圖表資料集)', async () => {
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
	});
	it('getReports 是 async 接縫(回 Promise)', () => {
		expect(getReports()).toBeInstanceOf(Promise);
	});

	it('getClasses 回傳整包課程資料(含 coaches)', async () => {
		const d = await getClasses();
		expect(d).toEqual({ classes: CLASSES, coaches: COACHES });
	});
	it('getClasses 是 async 接縫(回 Promise)', () => {
		expect(getClasses()).toBeInstanceOf(Promise);
	});

	it('getCoaches 回傳整包教練資料', async () => {
		const d = await getCoaches();
		expect(d).toEqual({ coaches: COACHES });
	});
	it('getCoaches 是 async 接縫(回 Promise)', () => {
		expect(getCoaches()).toBeInstanceOf(Promise);
	});
});
