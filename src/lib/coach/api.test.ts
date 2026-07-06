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
	deriveSessionStatus,
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

describe('getDashboard — GET /sessions/today（§3.18；後端已只回自己課程且依 start_time 排序）', () => {
	const SESSIONS_TODAY = [
		{ id: 's1', course_id: 'c1', course_name: '兒童體操初級班', start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 9 },
		{ id: 's2', course_id: 'c2', course_name: '青少年體操中級班', start_time: '10:30:00', end_time: '11:30:00', enrolled_count: 8 }
	];

	it('coach 由 myCoachProfile() 對映；todayClasses 直接映射 GET /sessions/today(不再前端過濾)；room/level/cat 無對應欄位一律預設值(P2)；status 依目前時間推導；統計欄位一律 0(P2)；conversations 仍為 mock', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 4, 9, 30, 0)); // 09:30 落在 s1 場次(09:00–10:00)中
		try {
			vi.mocked(api).mockImplementation(
				fakeRouter({
					'GET /users/me': ME,
					'GET /coaches': [MY_COACH, OTHER_COACH],
					'GET /sessions/today': SESSIONS_TODAY
				})
			);

			const d = await getDashboard();

			expect(d.todayClasses).toEqual([
				{ id: 's1', start: '09:00', end: '10:00', name: '兒童體操初級班', room: '', count: 9, level: '基礎', cat: '體操', status: 'live' },
				{ id: 's2', start: '10:30', end: '11:30', name: '青少年體操中級班', room: '', count: 8, level: '基礎', cat: '體操', status: 'wait' }
			]);
			expect(d.coach).toEqual(MAPPED_COACH);
			expect(d.todayLabel).toBe(TODAY_LABEL);
			expect(d.conversations).toEqual(CONVERSATIONS);
			expect(d.pendingClasses).toBe('0 班');
			expect(d.attendanceRate).toBe('0%');
			expect(d.pendingReplies).toBe('0 則');
		} finally {
			vi.useRealTimers();
		}
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getDashboard()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('getToday — 同 getDashboard 的今日場次來源，只回 todayLabel/todayClasses', () => {
	it('todayClasses 直接反映 GET /sessions/today', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH],
				'GET /sessions/today': [
					{ id: 's1', course_id: 'c1', course_name: '兒童體操初級班', start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 9 }
				]
			})
		);

		const d = await getToday();

		expect(d.todayLabel).toBe(TODAY_LABEL);
		expect(d.todayClasses).toHaveLength(1);
		expect(d.todayClasses[0].id).toBe('s1');
	});

	it('沒有今日場次時回傳空陣列(頁面顯示空狀態)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH], 'GET /sessions/today': [] })
		);

		const d = await getToday();

		expect(d.todayClasses).toEqual([]);
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getToday()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('deriveSessionStatus — §3.18 裁決 2(場次時間為牆鐘語意，本地直接比較，不做時區換算)', () => {
	it('now < start_time → wait', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 8, 59, 59))).toBe('wait');
	});

	it('now === start_time(邊界)→ live', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 9, 0, 0))).toBe('live');
	});

	it('start_time < now < end_time → live', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 9, 30, 0))).toBe('live');
	});

	it('now === end_time(邊界，已結束)→ done', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 10, 0, 0))).toBe('done');
	});

	it('now > end_time → done', () => {
		expect(deriveSessionStatus('09:00:00', '10:00:00', new Date(2026, 6, 4, 10, 0, 1))).toBe('done');
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
