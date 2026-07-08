import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getHome,
	getCourses,
	getMine,
	getAccount,
	getNotifications,
	getSchedule,
	getPoints,
	getReports
} from './api';
import {
	getCourses as memberGetCourses,
	getMine as memberGetMine,
	getSchedule as memberGetSchedule,
	getAccount as memberGetAccount,
	getNotifications as memberGetNotifications,
	getPoints as memberGetPoints,
	getReports as memberGetReports,
	getReportStats as memberGetReportStats
} from '$lib/member/api';
import { ANNOUNCE } from './data';

/* Task 19：mobile/api.ts 從整包 reply() mock 改為 desktop member seams 的薄層。
 * 這裡只 mock `$lib/member/api`(已在 member/api.test.ts 端對端測過真後端
 * 映射)——驗證 mobile 的每支函式「call 對桌面 seam + 正確薄映射/passthrough」，
 * 不重新測一次桌面早就測過的 HTTP 映射邏輯。 */
vi.mock('$lib/member/api', () => ({
	getCourses: vi.fn(),
	getMine: vi.fn(),
	getSchedule: vi.fn(),
	getAccount: vi.fn(),
	getNotifications: vi.fn(),
	getPoints: vi.fn(),
	getReports: vi.fn(),
	getReportStats: vi.fn()
}));

const CATALOG_FIXTURE = [
	{ id: 'c1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', days: '週二 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '示範課程', spots: 1 },
	{ id: 'c2', name: '未知分類實驗班', level: '入門', cat: '外星課程', age: '不限', days: '週日 10:00', price: 1000, hot: false, coach: '測試教練', desc: '', spots: 3 }
];

const MY_COURSES_FIXTURE = [
	{ id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '', icon: 'sparkles', color: '#0066CC', schedule: '週二 19:00', room: '', att: 96, attended: 24, total: 25, next: '', term: '', remain: 0 }
];

const SCHEDULE_FIXTURE = [
	{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' as const }
];

beforeEach(() => {
	vi.mocked(memberGetCourses).mockReset().mockResolvedValue({ catalog: CATALOG_FIXTURE });
	vi.mocked(memberGetMine).mockReset().mockResolvedValue({ courses: MY_COURSES_FIXTURE, attendance: [] });
	vi.mocked(memberGetSchedule).mockReset().mockResolvedValue({ schedule: SCHEDULE_FIXTURE });
	vi.mocked(memberGetAccount).mockReset().mockResolvedValue({
		orders: [{ id: 'DF-1', item: '測試訂單', amount: 100, status: ['success', '已付款'], date: '2026/01/01' }],
		profile: {
			name: '測試會員', initial: '測', color: '#000', id: 'u1', since: '2026/01', points: 0, age: 0,
			birth: '', phone: '', email: 'a@test.com', guardian: '', remind: true, promo: false
		}
	});
	vi.mocked(memberGetNotifications).mockReset().mockResolvedValue([]);
	vi.mocked(memberGetPoints).mockReset().mockResolvedValue({ rewards: [], expiring: '360 點', expiryDate: '2026/12/31' });
	vi.mocked(memberGetReports).mockReset().mockResolvedValue({ reportCards: [], certificates: [], stats: { attendedTotal: 0, attendanceRate: null, pointsBalance: 0, activeEnrolments: 0, upcomingSessions7d: 0 } });
	vi.mocked(memberGetReportStats).mockReset().mockResolvedValue({ attendedTotal: 0, attendanceRate: null, pointsBalance: 0, activeEnrolments: 0, upcomingSessions7d: 0 });
});

describe('getHome — 復用桌面 getCourses()/getMine()，薄映射 icon', () => {
	it('catalog 依分類對照表補上 icon;未知分類落回預設 icon', async () => {
		const d = await getHome();
		expect(d.catalog).toEqual([
			{ ...CATALOG_FIXTURE[0], icon: 'sparkles' },
			{ ...CATALOG_FIXTURE[1], icon: 'graduation-cap' }
		]);
	});
	it('myCourses 直接透傳桌面 getMine().courses(EnrolledCourse 形狀同源，零映射)', async () => {
		const d = await getHome();
		expect(d.myCourses).toBe(MY_COURSES_FIXTURE);
	});
	it('announce 後端無來源，沿用 mock(鏡射桌面 getDashboard() 的決定)', async () => {
		const d = await getHome();
		expect(d.announce).toBe(ANNOUNCE);
	});
	it('是 async 接縫(回 Promise)', () => {
		expect(getHome()).toBeInstanceOf(Promise);
	});
});

describe('getCourses — 復用桌面 getCourses()，同 icon 薄映射', () => {
	it('回傳映射後的 catalog', async () => {
		const d = await getCourses();
		expect(d).toEqual({ catalog: [{ ...CATALOG_FIXTURE[0], icon: 'sparkles' }, { ...CATALOG_FIXTURE[1], icon: 'graduation-cap' }] });
	});
});

describe('getMine — courses 復用桌面 getMine()，schedule 復用桌面 getSchedule()，stats 復用桌面 getReportStats()', () => {
	it('平行拉取三支桌面 seam，courses/schedule 皆透傳', async () => {
		const d = await getMine();
		expect(d.courses).toBe(MY_COURSES_FIXTURE);
		expect(d.schedule).toBe(SCHEDULE_FIXTURE);
	});
	it('attendanceRate/upcomingSessions7d/attendedTotal 原樣透傳桌面 getReportStats()(不在 api.ts 層格式化)', async () => {
		vi.mocked(memberGetReportStats).mockResolvedValue({
			attendedTotal: 24,
			attendanceRate: 0.88,
			pointsBalance: 999,
			activeEnrolments: 3,
			upcomingSessions7d: 5
		});
		const d = await getMine();
		expect(d.attendanceRate).toBe(0.88);
		expect(d.upcomingSessions7d).toBe(5);
		expect(d.attendedTotal).toBe(24);
	});
	it('attendanceRate 為 null(無出勤資料，裁決 3)時原樣穿透為 null，不竄改成字串或 0', async () => {
		vi.mocked(memberGetReportStats).mockResolvedValue({
			attendedTotal: 0,
			attendanceRate: null,
			pointsBalance: 0,
			activeEnrolments: 0,
			upcomingSessions7d: 0
		});
		const d = await getMine();
		expect(d.attendanceRate).toBeNull();
	});
});

describe('getAccount — 復用桌面 getAccount().orders', () => {
	it('只取 orders，不含 profile', async () => {
		const d = await getAccount();
		expect(d).toEqual({ orders: [{ id: 'DF-1', item: '測試訂單', amount: 100, status: ['success', '已付款'], date: '2026/01/01' }] });
	});
});

describe('getNotifications — 復用桌面 getNotifications()，零映射', () => {
	it('直接透傳', async () => {
		const fixture = [{ id: 'n1', cat: 'system' as const, icon: 'bell', tone: 'info' as const, title: 't', body: 'b', time: '剛剛', read: false }];
		vi.mocked(memberGetNotifications).mockResolvedValue(fixture);
		expect(await getNotifications()).toBe(fixture);
	});
});

describe('getSchedule — 復用桌面 getSchedule()，零映射(Task 9 週課表 seam)', () => {
	it('直接透傳桌面回應', async () => {
		expect(await getSchedule()).toEqual({ schedule: SCHEDULE_FIXTURE });
		expect(memberGetSchedule).toHaveBeenCalled();
	});
});

describe('getPoints — 復用桌面 getPoints()，零映射(Task 14 rewards seam)', () => {
	it('直接透傳桌面回應(rewards/expiring/expiryDate)', async () => {
		const fixture = { rewards: [{ id: 'r1', name: '毛巾', description: null, pointsCost: 300, stock: 5 }], expiring: '360 點', expiryDate: '2026/12/31' };
		vi.mocked(memberGetPoints).mockResolvedValue(fixture);
		expect(await getPoints()).toBe(fixture);
	});
});

describe('getReports — 復用桌面 getReports()，零映射(Task 13 seam)', () => {
	it('直接透傳桌面回應(reportCards/certificates/stats)', async () => {
		const fixture = {
			reportCards: [{ id: 'r1', courseName: '課程', termLabel: '2026 春季', comment: '很好', rating: 5, issuerName: '教練', createdAt: '2026-01-01' }],
			certificates: [],
			stats: { attendedTotal: 10, attendanceRate: 90, pointsBalance: 500, activeEnrolments: 2, upcomingSessions7d: 1 }
		};
		vi.mocked(memberGetReports).mockResolvedValue(fixture);
		expect(await getReports()).toBe(fixture);
	});
});
