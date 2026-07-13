import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getHome,
	getCourses,
	getMine,
	getAccount,
	getNotifications,
	getSchedule,
	getPoints,
	getReports,
	submitTrialInquiry,
	getPreferences,
	savePreferences
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
import { sendContactInquiry } from '$lib/public/api';
import { api } from '$lib/api/client';
import { ANNOUNCE } from './data';

/* Task 19：mobile/api.ts 從整包 reply() mock 改為 desktop member seams 的薄層。
 * 這裡只 mock `$lib/member/api`(已在 member/api.test.ts 端對端測過真後端
 * 映射)——驗證 mobile 的每支函式「call 對桌面 seam + 正確薄映射/passthrough」，
 * 不重新測一次桌面早就測過的 HTTP 映射邏輯。Task F8：submitTrialInquiry() 同理
 * 只 mock `$lib/public/api` 的 sendContactInquiry(已在 public/api.test.ts 端對端
 * 測過 POST /contact 映射)。Task F10：getPreferences/savePreferences 直接呼叫
 * `$lib/api/client` 的 api()(沒有桌面 seam 可薄包，users.preferences 是
 * mobile-only 的 Prefs 形狀)，因此這裡另外 mock api()，同 PointsScreen.test.ts
 * 的既有慣例。 */
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
vi.mock('$lib/public/api', () => ({ sendContactInquiry: vi.fn() }));
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const CATALOG_FIXTURE = [
	{ id: 'c1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', days: '週二 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '示範課程', spots: 1 },
	{ id: 'c2', name: '未知分類實驗班', level: '入門', cat: '外星課程', age: '不限', days: '週日 10:00', price: 1000, hot: false, coach: '測試教練', desc: '', spots: 3 }
];

const MY_COURSES_FIXTURE = [
	{ id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '', icon: 'sparkles' as const, color: '#0066CC', schedule: '週二 19:00', room: '', att: 96, attended: 24, total: 25, next: '', term: '', remain: 0 }
];

const SCHEDULE_FIXTURE = [
	{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' as const }
];

beforeEach(() => {
	vi.mocked(memberGetCourses).mockReset().mockResolvedValue({ catalog: CATALOG_FIXTURE });
	vi.mocked(memberGetMine).mockReset().mockResolvedValue({ courses: MY_COURSES_FIXTURE });
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
	vi.mocked(sendContactInquiry).mockReset().mockResolvedValue({} as never);
	vi.mocked(api).mockReset();
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

describe('getNotifications / getSchedule / getPoints / getReports — surface 邊界契約(純 identity 委派，零映射)', () => {
	it('四支皆直接透傳桌面 seam 的解析結果(toBe 比 toEqual 更強：reference 相等即委派證明)', async () => {
		const notificationsFixture = [{ id: 'n1', cat: 'system' as const, icon: 'bell' as const, tone: 'info' as const, title: 't', body: 'b', time: '剛剛', read: false }];
		vi.mocked(memberGetNotifications).mockResolvedValue(notificationsFixture);
		expect(await getNotifications()).toBe(notificationsFixture);

		const scheduleFixture = { schedule: SCHEDULE_FIXTURE };
		vi.mocked(memberGetSchedule).mockResolvedValue(scheduleFixture);
		expect(await getSchedule()).toBe(scheduleFixture);

		const pointsFixture = { rewards: [{ id: 'r1', name: '毛巾', description: null, pointsCost: 300, stock: 5 }], expiring: '360 點', expiryDate: '2026/12/31' };
		vi.mocked(memberGetPoints).mockResolvedValue(pointsFixture);
		expect(await getPoints()).toBe(pointsFixture);

		const reportsFixture = {
			reportCards: [{ id: 'r1', courseName: '課程', termLabel: '2026 春季', comment: '很好', rating: 5, issuerName: '教練', createdAt: '2026-01-01' }],
			certificates: [],
			stats: { attendedTotal: 10, attendanceRate: 90, pointsBalance: 500, activeEnrolments: 2, upcomingSessions7d: 1 }
		};
		vi.mocked(memberGetReports).mockResolvedValue(reportsFixture);
		expect(await getReports()).toBe(reportsFixture);
	});
});

describe('submitTrialInquiry — 復用桌面 sendContactInquiry()(POST /contact, inquiry_type=trial，Task F8)', () => {
	const INPUT = {
		category: '幼兒體操',
		studentAge: '3–5 歲',
		preferredDay: '2026/06/14 (六)',
		preferredSlot: '10:00–11:15',
		parentName: '王先生',
		parentPhone: '0912-345-678',
		studentName: '小恩',
		note: '曾學過舞蹈'
	};

	it('組出 ContactPayload：頂層 name/phone 取家長姓名/電話，email 為可辨識預設值，subject/message 為人讀摘要，metadata 帶滿 8 個 trial 慣例欄位', async () => {
		await submitTrialInquiry(INPUT);

		expect(sendContactInquiry).toHaveBeenCalledWith({
			name: '王先生',
			email: 'trial-inquiry@no-email.dreamfly.local',
			phone: '0912-345-678',
			subject: '試上預約:幼兒體操',
			message:
				'課程類別：幼兒體操\n學員年齡：3–5 歲\n預約時段：2026/06/14 (六) 10:00–11:15\n家長姓名：王先生\n聯絡手機：0912-345-678\n學員姓名：小恩\n備註：曾學過舞蹈',
			inquiry_type: 'trial',
			metadata: {
				category: '幼兒體操',
				student_age: '3–5 歲',
				preferred_day: '2026/06/14 (六)',
				preferred_slot: '10:00–11:15',
				parent_name: '王先生',
				parent_phone: '0912-345-678',
				student_name: '小恩',
				note: '曾學過舞蹈'
			}
		});
	});

	it('備註為空字串時 message 顯示「無」，但 metadata.note 保留原始空字串(後端原樣存取，不逐欄驗證)', async () => {
		await submitTrialInquiry({ ...INPUT, note: '' });

		const body = vi.mocked(sendContactInquiry).mock.calls[0][0];
		expect(body.message).toContain('備註：無');
		expect(body.metadata).toMatchObject({ note: '' });
	});

	it('回傳值直接透傳 sendContactInquiry() 的解析結果', async () => {
		const fixture = { id: 'inq1' };
		vi.mocked(sendContactInquiry).mockResolvedValue(fixture as never);
		expect(await submitTrialInquiry(INPUT)).toBe(fixture);
	});
});

describe('getPreferences — GET /users/me，preferences 映射(Task F10：users.preferences)', () => {
	it('preferences 為 null(未設定過)時四個 key 全部落回本地既有預設值', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'u1', preferences: null });
		expect(await getPreferences()).toEqual({ classReminder: true, coachMsg: true, promo: false, dark: false });
	});

	it('preferences 缺 key 時該欄位落回預設值，其餘欄位取後端值', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'u1', preferences: { class_reminder: false } });
		expect(await getPreferences()).toEqual({ classReminder: false, coachMsg: true, promo: false, dark: false });
	});

	it('preferences 四個 key 齊全時 snake_case 逐一映射為 camelCase', async () => {
		vi.mocked(api).mockResolvedValue({
			id: 'u1',
			preferences: { class_reminder: false, coach_msg: false, promo: true, dark: true }
		});
		expect(await getPreferences()).toEqual({ classReminder: false, coachMsg: false, promo: true, dark: true });
	});

	it('呼叫 GET /users/me(無 body)', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'u1', preferences: null });
		await getPreferences();
		expect(api).toHaveBeenCalledWith('/users/me');
	});
});

describe('savePreferences — PATCH /users/me { preferences }，整包覆寫(Task F10)', () => {
	it('camelCase → snake_case，送出四個慣例 key 的整包物件', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'u1', preferences: {} });
		await savePreferences({ classReminder: false, coachMsg: true, promo: false, dark: true });
		expect(api).toHaveBeenCalledWith('/users/me', {
			method: 'PATCH',
			body: JSON.stringify({
				preferences: { class_reminder: false, coach_msg: true, promo: false, dark: true }
			})
		});
	});

	it('不會送出 preferences: null(整包覆寫用法，不做清空路徑)', async () => {
		vi.mocked(api).mockResolvedValue({ id: 'u1', preferences: {} });
		await savePreferences({ classReminder: true, coachMsg: true, promo: false, dark: false });
		const [, init] = vi.mocked(api).mock.calls[0];
		const sentBody = JSON.parse((init as RequestInit).body as string);
		expect(sentBody.preferences).not.toBeNull();
	});

	it('失敗時原樣拋出(呼叫端負責回滾 + 錯誤提示)', async () => {
		vi.mocked(api).mockRejectedValue(new Error('network'));
		await expect(
			savePreferences({ classReminder: true, coachMsg: true, promo: false, dark: false })
		).rejects.toThrow('network');
	});
});
