import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHome, getCourses, getMine, submitTrialInquiry } from './api';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { apiBody, apiCalls } from '$lib/testing/admin-routes';
import { coachResponse, courseResponse, inquiryResponse, memberReport, myEnrolment, myScheduleEntry } from '$lib/testing/wire-fixtures';
import { ANNOUNCE } from './data';

/* Task 19：mobile/api.ts 從整包 reply() mock 改為 desktop member seams 的薄層。
 * W4d：只假造 HTTP(api())，桌面 getter + mapper 與 public sendContactInquiry 跑真的——
 * 驗證 mobile 的每支函式「打對端點 + 正確薄映射/passthrough」。
 * R13 Task 3：偏好讀寫(原 getPreferences/savePreferences)收進會員資料 module，測試在
 * self-account.test.ts。Task 7(架構深化 R15·F-4)：getAccount/getSchedule/getPoints/
 * getReports/getEnrolmentAttendance 五支純轉手已退役(mobile 消費端改直取
 * $lib/member/api)，本檔對應的覆蓋一併移除。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// wire 輸入：category '競技啦啦隊' → icon 'sparkles'；未知分類 → 預設 icon 'graduation-cap'。
const WIRE_COURSES = [
	courseResponse({ id: 'c1', name: '競技啦啦隊 進階班', level: 'advanced', category: '競技啦啦隊', min_age: 10, max_age: 16, schedule_text: '週二 19:00', price_cents: 480000, is_highlighted: true, coach_id: 'coach-1', description: '示範課程', max_students: 12, enrolled_count: 11 }),
	courseResponse({ id: 'c2', name: '未知分類實驗班', level: 'beginner', category: '外星課程', schedule_text: '週日 10:00', price_cents: 100000, is_highlighted: false, coach_id: null, description: null, max_students: 3, enrolled_count: 0 })
];
// 同上 wire 輸入經真 mapper 後的畫面形狀(不含 icon)。
const CATALOG_EXPECTED = [
	{ id: 'c1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', days: '週二 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '示範課程', spots: 1 },
	{ id: 'c2', name: '未知分類實驗班', level: '入門', cat: '外星課程', age: '', days: '週日 10:00', price: 1000, hot: false, coach: '', desc: '', spots: 3 }
];

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(over, {
			'GET /courses?per_page=100': { courses: WIRE_COURSES, total: 2, page: 1, per_page: 100 },
			'GET /coaches': [coachResponse({ id: 'coach-1', name: '林雅婷' })],
			'GET /enrolments/me': [myEnrolment({ id: 'e1', course_id: 'c1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 19:00', attended: 24, total: 25 })],
			'GET /schedule/me': [myScheduleEntry({ course_name: '競技啦啦隊 進階班', day_of_week: 2, start_time: '19:00:00', end_time: '20:30:00', venue: 'A 訓練館', coach_name: '林雅婷' })],
			'GET /reports/me': memberReport(),
			'POST /contact': inquiryResponse()
		})
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('getHome — 復用桌面 getCourses()，薄映射 icon', () => {
	it('catalog 依分類對照表補上 icon;未知分類落回預設 icon', async () => {
		const d = await getHome();
		expect(d.catalog).toEqual([
			{ ...CATALOG_EXPECTED[0], icon: 'sparkles' },
			{ ...CATALOG_EXPECTED[1], icon: 'graduation-cap' }
		]);
	});
	it('不再拉 getMine()(R16 Task 2c：首頁的「下一堂課」卡已拿掉，沒有讀報名課程的地方)', async () => {
		const d = await getHome();
		expect(apiCalls('GET /enrolments/me')).toHaveLength(0);
		expect(d).not.toHaveProperty('myCourses');
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
		expect(d).toEqual({ catalog: [{ ...CATALOG_EXPECTED[0], icon: 'sparkles' }, { ...CATALOG_EXPECTED[1], icon: 'graduation-cap' }] });
	});
});

describe('getMine — courses 復用桌面 getMine()，schedule 復用桌面 getSchedule()，stats 復用桌面 getReportStats()', () => {
	it('平行拉取三支桌面 seam，courses/schedule 皆經桌面 mapper 後原樣帶入', async () => {
		const d = await getMine();
		expect(d.courses).toEqual([
			{ id: 'e1', course_id: 'c1', name: '競技啦啦隊 進階班', level: '進階', icon: 'sparkles', color: '#0066CC', schedule: '週二 19:00', att: 96, attended: 24, total: 25 }
		]);
		// 後端 day_of_week 2(週二) → mapper day 1(0=一，#18)。
		expect(d.schedule).toEqual([
			{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' }
		]);
	});
	it('attendanceRate/upcomingSessions7d/attendedTotal 原樣透傳桌面 getReportStats()(不在 api.ts 層格式化)', async () => {
		route({
			'GET /reports/me': memberReport({ attended_total: 24, attendance_rate: 0.88, points_balance: 999, active_enrolments: 3, upcoming_sessions_7d: 5 })
		});
		const d = await getMine();
		expect(d.attendanceRate).toBe(0.88);
		expect(d.upcomingSessions7d).toBe(5);
		expect(d.attendedTotal).toBe(24);
	});
	it('attendanceRate 為 null(無出勤資料，裁決 3)時原樣穿透為 null，不竄改成字串或 0', async () => {
		route({ 'GET /reports/me': memberReport({ attendance_rate: null }) });
		const d = await getMine();
		expect(d.attendanceRate).toBeNull();
	});
});

describe('submitTrialInquiry — 復用 public sendContactInquiry()(POST /contact, inquiry_type=trial，Task F8)', () => {
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

		expect(apiBody('POST /contact')).toEqual({
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

		const body = apiBody('POST /contact') as { message: string; metadata: unknown };
		expect(body.message).toContain('備註：無');
		expect(body.metadata).toMatchObject({ note: '' });
	});

	it('回傳值直接透傳 sendContactInquiry() 的解析結果', async () => {
		const fixture = inquiryResponse({ id: 'inq1' });
		route({ 'POST /contact': fixture });
		expect(await submitTrialInquiry(INPUT)).toEqual(fixture);
	});
});
