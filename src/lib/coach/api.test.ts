/* Dream Fly — coach/api.ts 單測(Task 19：getDashboard/getToday/getSchedule/getSettings
 * 換真後端資料 + saveSettings 新增；getAttendance/getMessages/getStudents 仍為 mock)。
 *
 * 只 mock $lib/api/client 的 api() —— listCourses/listCoaches(Task 14 public seam)
 * 一律用真實實作，這樣才是「後端形狀進、UI 形狀出」的端對端斷言，同 admin/api.test.ts
 * 的作法。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	myCoachProfile,
	getDashboard,
	getToday,
	getAttendance,
	getSchedule,
	getMessages,
	getStudents,
	getSettings,
	saveSettings,
	CoachNotFoundError
} from './api';
import { api } from '$lib/api/client';
import {
	TODAY_LABEL,
	CONVERSATIONS,
	ATT_TODAY_CLASSES,
	STUDENTS,
	MSG_DIRECTORY,
	THREAD,
	SHARED_FILES
} from './data';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；未交代的端點一律丟錯，讓漏掉
 *  某支 mock 的測試直接失敗而不是悄悄回傳 undefined(同 admin/member api.test.ts)。 */
function fakeRouter(overrides: Record<string, unknown>) {
	return vi.fn(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		const key = `${method} ${path}`;
		if (key in overrides) {
			const value = overrides[key];
			if (value instanceof Error) throw value;
			return value;
		}
		throw new Error(`unexpected api call: ${key}`);
	});
}

const ME = {
	id: 'u1',
	email: 'lin@dreamfly.com.tw',
	name: '林雅婷',
	phone: '0912-000-111',
	last_login: '2026-07-04T08:42:00Z',
	created_at: '2019-08-15T00:00:00Z'
};
const MY_COACH = {
	id: 'co1', user_id: 'u1', title: '資深體操教練', bio: '專注幼兒體操教學。',
	experience: '6 年', specialties: ['體操'], certifications: ['國家級教練證'],
	is_active: true, display_order: 1, slug: null, photo_url: null,
	created_at: '2019-08-15T00:00:00Z'
};
const OTHER_COACH = { ...MY_COACH, id: 'co2', user_id: 'u2', title: '跑酷教練' };

const MAPPED_COACH = {
	name: '林雅婷', display: '林教練', full: '林雅婷 教練', en: '', initial: '林',
	role: '資深體操教練', id: 'co1', email: 'lin@dreamfly.com.tw', phone: '0912-000-111',
	gender: '', birth: '', emergency: '', bio: '專注幼兒體操教學。',
	chips: ['國家級教練證'], registered: '2019-08-15', lastLogin: '2026-07-04 08:42'
};

beforeEach(() => {
	vi.mocked(api).mockReset();
});

describe('myCoachProfile — GET /users/me → GET /coaches → find(user_id === me.id)', () => {
	it('找到對應教練時回傳該筆 ApiCoach', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH, MY_COACH] })
		);
		const coach = await myCoachProfile();
		expect(coach).toEqual(MY_COACH);
	});

	it('找不到對應教練時回傳 null', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		const coach = await myCoachProfile();
		expect(coach).toBeNull();
	});
});

describe('getDashboard — GET /courses 過濾 coach_id === myCoach.id', () => {
	const COURSES_RESPONSE = {
		courses: [
			{
				id: 'c1', name: '兒童體操初級班', slug: 'x', level: 'beginner', description: null,
				duration_minutes: 60, price_cents: 100000, max_students: 12, min_age: 5, max_age: 8,
				features: [], is_active: true, coach_id: 'co1', category: '體操',
				schedule_text: '週二、四 16:00-17:00', is_highlighted: false, created_at: '', updated_at: '',
				enrolled_count: 9, waitlist_count: 0
			},
			{
				id: 'c2', name: '別的教練的課', slug: 'y', level: 'advanced', description: null,
				duration_minutes: 60, price_cents: 100000, max_students: 10, min_age: 5, max_age: 8,
				features: [], is_active: true, coach_id: 'co2', category: '跑酷', schedule_text: null,
				is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 3, waitlist_count: 0
			},
			{
				id: 'c3', name: '啦啦隊基礎班', slug: 'z', level: 'intermediate', description: null,
				duration_minutes: 60, price_cents: 100000, max_students: 10, min_age: 5, max_age: 8,
				features: [], is_active: true, coach_id: 'co1', category: '啦啦', schedule_text: null,
				is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 5, waitlist_count: 0
			}
		],
		total: 3, page: 1, per_page: 100
	};

	it('coach 由 myCoachProfile() 對映；todayClasses 只含 coach_id 相符的課程；統計欄位一律 0(P2)；conversations 仍為 mock', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH, OTHER_COACH],
				'GET /courses?per_page=100': COURSES_RESPONSE
			})
		);

		const d = await getDashboard();

		expect(d.todayClasses).toHaveLength(2); // c2 (別的教練) 濾除
		const c1 = d.todayClasses.find((c) => c.id === 'c1')!;
		expect(c1.name).toBe('兒童體操初級班');
		expect(c1.start).toBe('16:00');
		expect(c1.end).toBe('17:00');
		expect(c1.count).toBe(9); // enrolled_count
		expect(c1.level).toBe('初級'); // beginner
		expect(c1.cat).toBe('體操');
		expect(c1.room).toBe(''); // P2
		expect(c1.status).toBe('wait'); // P2

		const c3 = d.todayClasses.find((c) => c.id === 'c3')!;
		expect(c3.start).toBe(''); // schedule_text: null
		expect(c3.end).toBe('');
		expect(c3.level).toBe('中級'); // intermediate
		expect(c3.cat).toBe('啦啦隊'); // category '啦啦' → SchedCat '啦啦隊'

		expect(d.coach).toEqual(MAPPED_COACH);
		expect(d.todayLabel).toBe(TODAY_LABEL);
		expect(d.conversations).toEqual(CONVERSATIONS);
		expect(d.pendingClasses).toBe('0 班');
		expect(d.attendanceRate).toBe('0%');
		expect(d.pendingReplies).toBe('0 則');
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getDashboard()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('getToday — 同 getDashboard 的課程過濾，只回 todayLabel/todayClasses', () => {
	it('todayClasses 只含 coach_id 相符的課程', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH, OTHER_COACH],
				'GET /courses?per_page=100': {
					courses: [
						{
							id: 'c1', name: '兒童體操初級班', slug: 'x', level: 'beginner', description: null,
							duration_minutes: 60, price_cents: 100000, max_students: 12, min_age: 5, max_age: 8,
							features: [], is_active: true, coach_id: 'co1', category: '體操',
							schedule_text: '週二、四 16:00-17:00', is_highlighted: false, created_at: '', updated_at: '',
							enrolled_count: 9, waitlist_count: 0
						},
						{
							id: 'c2', name: '別的教練的課', slug: 'y', level: 'advanced', description: null,
							duration_minutes: 60, price_cents: 100000, max_students: 10, min_age: 5, max_age: 8,
							features: [], is_active: true, coach_id: 'co2', category: '跑酷', schedule_text: null,
							is_highlighted: false, created_at: '', updated_at: '', enrolled_count: 3, waitlist_count: 0
						}
					],
					total: 2, page: 1, per_page: 100
				}
			})
		);

		const d = await getToday();

		expect(d.todayLabel).toBe(TODAY_LABEL);
		expect(d.todayClasses).toHaveLength(1);
		expect(d.todayClasses[0].id).toBe('c1');
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getToday()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('getSchedule — GET /coaches/{id}/schedule 週班表映射', () => {
	it('day_of_week 0–6 對映 Sun..Sat key；HH:MM:SS 裁切為 HH:MM；只保留 is_available 的時段', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH],
				'GET /coaches/co1/schedule': [
					{ id: 's1', day_of_week: 0, start_time: '09:00:00', end_time: '10:00:00', is_available: true },
					{ id: 's2', day_of_week: 6, start_time: '14:00:00', end_time: '15:30:00', is_available: true },
					{ id: 's3', day_of_week: 3, start_time: '08:00:00', end_time: '09:00:00', is_available: false }
				]
			})
		);

		const d = await getSchedule();

		expect(api).toHaveBeenCalledWith('/coaches/co1/schedule', { auth: false });
		expect(d.courses).toHaveLength(2); // s3(不可授課)濾除
		const sun = d.courses.find((c) => c.day === 'Sun')!;
		expect(sun.start).toBe('09:00');
		expect(sun.end).toBe('10:00');
		const sat = d.courses.find((c) => c.day === 'Sat')!;
		expect(sat.start).toBe('14:00');
		expect(sat.end).toBe('15:30');
		// 無對應欄位的一律誠實預設值(P2)
		for (const c of d.courses) {
			expect(c.count).toBe(0);
			expect(c.cat).toBe('體操');
			expect(c.venue).toBe('主場館');
		}
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getSchedule()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('getSettings — GET /users/me + GET /coaches → 既有 Coach 形狀', () => {
	it('name/display/full/initial 由 user.name 推導；role/bio/chips 來自 ApiCoach；id 改用教練 uuid；gender/birth/emergency 無對應欄位(P2)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH] })
		);

		const d = await getSettings();

		expect(d.coach).toEqual(MAPPED_COACH);
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getSettings()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('saveSettings — PATCH /users/me，寫入後重新取得最新 Coach 資料', () => {
	it('送出 { name, phone }；回傳依最新 GET /users/me + GET /coaches 重新映射的 Coach', async () => {
		const updated = { ...ME, name: '林雅婷(改)', phone: '0900-000-000' };
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'PATCH /users/me': updated,
				'GET /users/me': updated,
				'GET /coaches': [MY_COACH]
			})
		);

		const d = await saveSettings({ name: '林雅婷(改)', phone: '0900-000-000' });

		expect(api).toHaveBeenCalledWith('/users/me', {
			method: 'PATCH',
			body: JSON.stringify({ name: '林雅婷(改)', phone: '0900-000-000' })
		});
		expect(d.coach.name).toBe('林雅婷(改)');
		expect(d.coach.phone).toBe('0900-000-000');
	});
});

describe('getAttendance — 仍為 mock(P2：無對應後端點名端點)', () => {
	it('getAttendance 回傳整包點名資料', async () => {
		const d = await getAttendance();
		expect(d).toEqual({ classes: ATT_TODAY_CLASSES });
	});
	it('getAttendance 是 async 接縫(回 Promise)', () => {
		expect(getAttendance()).toBeInstanceOf(Promise);
	});
});

describe('getMessages — 仍為 mock(P2：無對應後端訊息中心端點)', () => {
	it('getMessages 回傳整包訊息中心資料', async () => {
		const d = await getMessages();
		expect(d).toEqual({
			conversations: CONVERSATIONS,
			directory: MSG_DIRECTORY,
			thread: THREAD,
			sharedFiles: SHARED_FILES
		});
	});
	it('getMessages 是 async 接縫(回 Promise)', () => {
		expect(getMessages()).toBeInstanceOf(Promise);
	});
});

describe('getStudents — 仍為 mock(P2：無對應後端學員名冊端點)', () => {
	it('getStudents 回傳整包學員資料', async () => {
		const d = await getStudents();
		expect(d).toEqual({ students: STUDENTS });
	});
	it('getStudents 是 async 接縫(回 Promise)', () => {
		expect(getStudents()).toBeInstanceOf(Promise);
	});
});
