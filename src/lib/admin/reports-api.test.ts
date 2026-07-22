/* Dream Fly — admin/reports-api.ts 單測。C5（第八輪架構深化）自 admin/api.test.ts
 * 拆出 getReports 測試段（純 locality 整理，斷言與 fixture 不變）；只 mock
 * $lib/api/client 的 api()，同源檔既有慣例。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReports } from './reports-api';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('getReports — GET /reports/admin（admin，§3.24，Round 4 P4-F1：12 組金流/人流彙總 + coaches[] 兩新欄）', () => {
	it('revenue/members 經 ntd() 換算並改名為 camelCase；courses/coaches 依 course_id/coach_id 映射；新 12 組 sections snake_case→camelCase', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /reports/admin': {
					revenue: {
						this_month_cents: 45820000,
						last_month_cents: 40000000,
						trend: [
							{ month: '2025-08', revenue_cents: 10000000 },
							{ month: '2025-09', revenue_cents: 11000000 }
						]
					},
					kpis: {
						new_members: { this_month: 8, last_month: 5 },
						new_enrolments: { this_month: 14, last_month: 10 },
						paid_orders_count: { this_month: 42, last_month: 38 },
						attendance_rate: { this_month: 0.92, last_month: null }
					},
					revenue_breakdown: [
						{ source: 'course', gross_cents: 3000000, orders_count: 20, units: 25 },
						{ source: 'venue_rental', gross_cents: 50000, orders_count: 3, units: 3 }
					],
					income_sources_12m: [
						{ month: '2025-08', source: 'course', gross_cents: 2500000, orders_count: 18, units: 22 },
						{ month: '2025-09', source: 'course', gross_cents: 3000000, orders_count: 20, units: 25 }
					],
					category_split: [
						{ source: 'course', gross_cents: 3000000, ratio: 0.85 },
						{ source: 'ticket', gross_cents: 500000, ratio: null }
					],
					payment_split: [
						{ method: 'credit_card', count: 30 },
						{ method: 'unknown', count: 2 }
					],
					attendance_distribution: [
						{ bucket: 'gte_95', count: 11 },
						{ bucket: 'lt_75', count: 6 }
					],
					age_distribution: [
						{ bucket: '7-12', count: 34 },
						{ bucket: '41+', count: 2 }
					],
					tier_distribution: [
						{ bucket: 'gold', count: 9 },
						{ bucket: 'regular', count: 10 }
					],
					retention: [
						{ month: '2025-08', new_count: 14, returning_count: 38, rate: 0.71 },
						{ month: '2025-09', new_count: 18, returning_count: 41, rate: null }
					],
					funnel: { trial_inquiries: 318, new_enrolments: 142 },
					weekday_load: [
						{ weekday: 0, present_count: 20 },
						{ weekday: 6, present_count: 45 }
					],
					venue_usage: [{ venue: 'A 訓練館', minutes: 8880 }],
					members: { total: 120, new_this_month: 8, active: 96 },
					courses: [
						{ course_id: 'c1', name: '競技體操 選手班', enrolled: 12, max_students: 12, fill_rate: 1, waitlist_count: 4 },
						{ course_id: 'c2', name: '兒童基礎 B 班', enrolled: 7, max_students: 10, fill_rate: 0.7, waitlist_count: 0 }
					],
					coaches: [
						{
							coach_id: 'co1',
							name: '林雅婷',
							course_count: 3,
							student_count: 28,
							revenue_cents_12m: 850000,
							attendance_rate: 0.96
						}
					]
				}
			})
		);

		const d = await getReports();

		expect(api).toHaveBeenCalledWith('/reports/admin');
		expect(d).toEqual({
			revenue: {
				thisMonth: 458200,
				lastMonth: 400000,
				trend: [
					{ m: '2025-08', h: 100000 },
					{ m: '2025-09', h: 110000 }
				]
			},
			kpis: {
				newMembers: { thisMonth: 8, lastMonth: 5 },
				newEnrolments: { thisMonth: 14, lastMonth: 10 },
				paidOrdersCount: { thisMonth: 42, lastMonth: 38 },
				attendanceRate: { thisMonth: 0.92, lastMonth: null }
			},
			revenueBreakdown: [
				{ source: 'course', grossCents: 3000000, ordersCount: 20, units: 25 },
				{ source: 'venue_rental', grossCents: 50000, ordersCount: 3, units: 3 }
			],
			incomeSources12m: [
				{ month: '2025-08', source: 'course', grossCents: 2500000, ordersCount: 18, units: 22 },
				{ month: '2025-09', source: 'course', grossCents: 3000000, ordersCount: 20, units: 25 }
			],
			categorySplit: [
				{ source: 'course', grossCents: 3000000, ratio: 0.85 },
				{ source: 'ticket', grossCents: 500000, ratio: null }
			],
			paymentSplit: [
				{ method: 'credit_card', count: 30 },
				{ method: 'unknown', count: 2 }
			],
			attendanceDistribution: [
				{ bucket: 'gte_95', count: 11 },
				{ bucket: 'lt_75', count: 6 }
			],
			ageDistribution: [
				{ bucket: '7-12', count: 34 },
				{ bucket: '41+', count: 2 }
			],
			tierDistribution: [
				{ bucket: 'gold', count: 9 },
				{ bucket: 'regular', count: 10 }
			],
			retention: [
				{ month: '2025-08', newCount: 14, returningCount: 38, rate: 0.71 },
				{ month: '2025-09', newCount: 18, returningCount: 41, rate: null }
			],
			funnel: { trialInquiries: 318, newEnrolments: 142 },
			weekdayLoad: [
				{ weekday: 0, presentCount: 20 },
				{ weekday: 6, presentCount: 45 }
			],
			venueUsage: [{ venue: 'A 訓練館', minutes: 8880 }],
			members: { total: 120, newThisMonth: 8, active: 96 },
			courses: [
				{ id: 'c1', name: '競技體操 選手班', enrolled: 12, maxStudents: 12, fillRate: 1, waitlistCount: 4 },
				{ id: 'c2', name: '兒童基礎 B 班', enrolled: 7, maxStudents: 10, fillRate: 0.7, waitlistCount: 0 }
			],
			coaches: [
				{ id: 'co1', name: '林雅婷', courseCount: 3, studentCount: 28, revenueCents12m: 850000, attendanceRate: 0.96 }
			]
		});
	});

	it('fill_rate/attendance_rate 為 null(防禦性 null：courses 見裁決 4／coaches、kpis.attendanceRate 為無出勤資料)時原樣穿透，不竄改成 0', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /reports/admin': {
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
					courses: [{ course_id: 'c1', name: '空堂', enrolled: 0, max_students: 0, fill_rate: null, waitlist_count: 0 }],
					coaches: [
						{
							coach_id: 'co1',
							name: '新教練',
							course_count: 0,
							student_count: 0,
							revenue_cents_12m: 0,
							attendance_rate: null
						}
					]
				}
			})
		);

		const d = await getReports();
		expect(d.courses[0].fillRate).toBeNull();
		expect(d.coaches[0].attendanceRate).toBeNull();
		expect(d.kpis.attendanceRate).toEqual({ thisMonth: null, lastMonth: null });
	});

	it('空庫：revenue 全 0(trend 12 筆皆 0)、members 全 0、courses/coaches/paymentSplit/venueUsage 皆 []；kpis 全 0(attendanceRate 兩欄 null)、funnel 兩欄 0；固定桶零填(revenueBreakdown 6、incomeSources12m 72、categorySplit 5、attendanceDistribution 4、ageDistribution 6、tierDistribution 4、retention 6、weekdayLoad 7)，不是 500', async () => {
		const zeroTrend = Array.from({ length: 12 }, (_, i) => ({
			month: `2025-${String(i + 1).padStart(2, '0')}`,
			revenue_cents: 0
		}));
		const revenueSources = ['course', 'ticket', 'membership', 'course_package', 'merchandise', 'venue_rental'];
		const categorySources = ['course', 'ticket', 'membership', 'course_package', 'merchandise'];
		const zeroRevenueBreakdown = revenueSources.map((source) => ({ source, gross_cents: 0, orders_count: 0, units: 0 }));
		const zeroIncomeSources12m = zeroTrend.flatMap(({ month }) =>
			revenueSources.map((source) => ({ month, source, gross_cents: 0, orders_count: 0, units: 0 }))
		);
		const zeroCategorySplit = categorySources.map((source) => ({ source, gross_cents: 0, ratio: null }));
		const zeroAttendanceDist = ['gte_95', '85_94', '75_84', 'lt_75'].map((bucket) => ({ bucket, count: 0 }));
		const zeroAgeDist = ['0-6', '7-12', '13-17', '18-25', '26-40', '41+'].map((bucket) => ({ bucket, count: 0 }));
		const zeroTierDist = ['regular', 'bronze', 'silver', 'gold'].map((bucket) => ({ bucket, count: 0 }));
		const zeroRetention = Array.from({ length: 6 }, (_, i) => ({
			month: `2025-${String(i + 1).padStart(2, '0')}`,
			new_count: 0,
			returning_count: 0,
			rate: null
		}));
		const zeroWeekdayLoad = Array.from({ length: 7 }, (_, weekday) => ({ weekday, present_count: 0 }));

		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /reports/admin': {
					revenue: { this_month_cents: 0, last_month_cents: 0, trend: zeroTrend },
					kpis: {
						new_members: { this_month: 0, last_month: 0 },
						new_enrolments: { this_month: 0, last_month: 0 },
						paid_orders_count: { this_month: 0, last_month: 0 },
						attendance_rate: { this_month: null, last_month: null }
					},
					revenue_breakdown: zeroRevenueBreakdown,
					income_sources_12m: zeroIncomeSources12m,
					category_split: zeroCategorySplit,
					payment_split: [],
					attendance_distribution: zeroAttendanceDist,
					age_distribution: zeroAgeDist,
					tier_distribution: zeroTierDist,
					retention: zeroRetention,
					funnel: { trial_inquiries: 0, new_enrolments: 0 },
					weekday_load: zeroWeekdayLoad,
					venue_usage: [],
					members: { total: 0, new_this_month: 0, active: 0 },
					courses: [],
					coaches: []
				}
			})
		);

		const d = await getReports();
		expect(d.revenue.thisMonth).toBe(0);
		expect(d.revenue.lastMonth).toBe(0);
		expect(d.revenue.trend).toHaveLength(12);
		expect(d.revenue.trend.every((t) => t.h === 0)).toBe(true);
		expect(d.members).toEqual({ total: 0, newThisMonth: 0, active: 0 });
		expect(d.courses).toEqual([]);
		expect(d.coaches).toEqual([]);
		expect(d.paymentSplit).toEqual([]);
		expect(d.venueUsage).toEqual([]);
		expect(d.kpis).toEqual({
			newMembers: { thisMonth: 0, lastMonth: 0 },
			newEnrolments: { thisMonth: 0, lastMonth: 0 },
			paidOrdersCount: { thisMonth: 0, lastMonth: 0 },
			attendanceRate: { thisMonth: null, lastMonth: null }
		});
		expect(d.funnel).toEqual({ trialInquiries: 0, newEnrolments: 0 });
		expect(d.revenueBreakdown).toHaveLength(6);
		expect(d.incomeSources12m).toHaveLength(72);
		expect(d.categorySplit).toHaveLength(5);
		expect(d.attendanceDistribution).toHaveLength(4);
		expect(d.ageDistribution).toHaveLength(6);
		expect(d.tierDistribution).toHaveLength(4);
		expect(d.retention).toHaveLength(6);
		expect(d.weekdayLoad).toHaveLength(7);
		expect(d.revenueBreakdown.every((r) => r.grossCents === 0)).toBe(true);
		expect(d.categorySplit.every((c) => c.ratio === null)).toBe(true);
		expect(d.retention.every((r) => r.rate === null)).toBe(true);
	});
});
