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
	saveAttendance,
	getSchedule,
	getConversations,
	getThread,
	sendMessage,
	markRead,
	createConversation,
	getStudents,
	getSettings,
	saveSettings,
	createCertificate,
	createReportCard,
	deriveSessionStatus,
	getPendingLeaveRequests,
	decideLeaveRequest,
	CoachNotFoundError
} from './api';
import { api } from '$lib/api/client';
import { TODAY_LABEL } from './data';

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

	const REPORTS = {
		today_sessions: 2,
		pending_attendance: 1,
		unread_messages: 3,
		student_count: 12,
		attendance_rate_30d: 0.8
	};

	it('coach 由 myCoachProfile() 對映；todayClasses 直接映射 GET /sessions/today(不再前端過濾)；room/level/cat 無對應欄位一律預設值(P2)；status 依目前時間推導；待點名/出席率/待回覆改讀 GET /reports/coach(§3.24)；conversations 仍為 mock', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 4, 9, 30, 0)); // 09:30 落在 s1 場次(09:00–10:00)中
		try {
			vi.mocked(api).mockImplementation(
				fakeRouter({
					'GET /users/me': ME,
					'GET /coaches': [MY_COACH, OTHER_COACH],
					'GET /sessions/today': SESSIONS_TODAY,
					'GET /reports/coach': REPORTS,
					'GET /conversations/me': [
						{ id: 'cv1', peer_id: 'up1', peer_name: '王小明', last_message_body: '老師您好', last_message_at: '2026-07-05T09:42:00Z', unread_count: 2 }
					]
				})
			);

			const d = await getDashboard();

			expect(d.todayClasses).toEqual([
				{ id: 's1', start: '09:00', end: '10:00', name: '兒童體操初級班', room: '', count: 9, level: '基礎', cat: '體操', status: 'live' },
				{ id: 's2', start: '10:30', end: '11:30', name: '青少年體操中級班', room: '', count: 8, level: '基礎', cat: '體操', status: 'wait' }
			]);
			expect(d.coach).toEqual(MAPPED_COACH);
			expect(d.todayLabel).toBe(TODAY_LABEL);
			// conversations 由 getDashboard() 併入真 getConversations() —— mapConversation 映射結果。
			expect(d.conversations).toEqual([
				{ id: 'cv1', name: '王小明', initial: '王', color: '#0066CC', kind: '會員', time: '2026-07-05 09:42', badge: 2, preview: '老師您好', sla: '', slaTone: 'muted' }
			]);
			expect(d.pendingClasses).toBe('1 班');
			expect(d.attendanceRate).toBe('80%');
			expect(d.pendingReplies).toBe('3 則');
		} finally {
			vi.useRealTimers();
		}
	});

	it('attendance_rate_30d 為 null(無出勤資料)時顯示「尚無資料」而非 0%', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH, OTHER_COACH],
				'GET /sessions/today': [],
				'GET /reports/coach': { ...REPORTS, attendance_rate_30d: null },
				'GET /conversations/me': [
					{ id: 'cv1', peer_id: 'up1', peer_name: '王小明', last_message_body: '老師您好', last_message_at: '2026-07-05T09:42:00Z', unread_count: 2 }
				]
			})
		);

		const d = await getDashboard();
		expect(d.attendanceRate).toBe('尚無資料');
		// 非空斷言把 best-effort .catch 的「漏 route → 空陣列」分支釘住(否則漏補 route 也會綠)。
		expect(d.conversations).toHaveLength(1);
	});

	it('空域(今日無場次、待點名/未讀訊息皆 0)時 pendingClasses/pendingReplies 為「0 班」「0 則」，不是 500', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH, OTHER_COACH],
				'GET /sessions/today': [],
				'GET /reports/coach': {
					today_sessions: 0,
					pending_attendance: 0,
					unread_messages: 0,
					student_count: 0,
					attendance_rate_30d: null
				},
				// 今日無場次不代表沒有對話串——給一筆真對話，把 best-effort 空陣列分支釘住。
				'GET /conversations/me': [
					{ id: 'cv1', peer_id: 'up1', peer_name: '林小美', last_message_body: '謝謝老師', last_message_at: '2026-07-04T08:00:00Z', unread_count: 0 }
				]
			})
		);

		const d = await getDashboard();
		expect(d.todayClasses).toEqual([]);
		expect(d.pendingClasses).toBe('0 班');
		expect(d.pendingReplies).toBe('0 則');
		expect(d.attendanceRate).toBe('尚無資料');
		expect(d.conversations).toHaveLength(1);
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError(不會先打 GET /reports/coach)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getDashboard()).rejects.toThrow(CoachNotFoundError);
	});

	it('GET /conversations/me 失敗時 conversations 降級為空陣列，KPI/今日課程照常(best-effort)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH, OTHER_COACH],
				'GET /sessions/today': SESSIONS_TODAY,
				'GET /reports/coach': REPORTS,
				'GET /conversations/me': new Error('boom')
			})
		);

		const d = await getDashboard();

		expect(d.conversations).toEqual([]);
		expect(d.todayClasses).toHaveLength(2);
		expect(d.pendingClasses).toBe('1 班');
		expect(d.attendanceRate).toBe('80%');
		expect(d.pendingReplies).toBe('3 則');
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

describe('getAttendance — GET /sessions/today + GET /sessions/{id}/roster（§3.19）', () => {
	const SESSIONS_TODAY = [
		{ id: 's1', course_id: 'c1', course_name: '兒童體操初級班', start_time: '09:00:00', end_time: '10:00:00', enrolled_count: 2 },
		{ id: 's2', course_id: 'c2', course_name: '青少年體操中級班', start_time: '10:30:00', end_time: '11:30:00', enrolled_count: 1 }
	];
	const ROSTER_S1 = [
		{ enrolment_id: 'en-1', user_id: 'u1', user_name: '王小明', attendance_status: 'present' },
		{ enrolment_id: 'en-2', user_id: 'u2', user_name: '陳小華', attendance_status: null }
	];
	const ROSTER_S2 = [
		{ enrolment_id: 'en-3', user_id: 'u3', user_name: '林小美', attendance_status: 'leave' }
	];

	it('今日每個場次各自平行拉取名冊，映射為既有 AttClassFull/AttRow 形狀；attendance_status 為 null 時本地草稿預設 present', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH],
				'GET /sessions/today': SESSIONS_TODAY,
				'GET /sessions/s1/roster': ROSTER_S1,
				'GET /sessions/s2/roster': ROSTER_S2
			})
		);

		const d = await getAttendance();

		expect(d.classes).toEqual([
			{
				id: 's1', name: '兒童體操初級班', time: '今日 09:00–10:00', room: '', coach: '林雅婷',
				roster: [
					{ n: '01', name: '王小明', initial: '王', color: '#0066CC', mid: 'en-1', def: 'present' },
					{ n: '02', name: '陳小華', initial: '陳', color: '#0066CC', mid: 'en-2', def: 'present' }
				]
			},
			{
				id: 's2', name: '青少年體操中級班', time: '今日 10:30–11:30', room: '', coach: '林雅婷',
				roster: [{ n: '01', name: '林小美', initial: '林', color: '#0066CC', mid: 'en-3', def: 'leave' }]
			}
		]);
		expect(d.failedClasses).toEqual([]);
	});

	it('部分失敗隔離：一場次名冊失敗時，成功場次照常回傳可點名，失敗場次課名列入 failedClasses', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH],
				'GET /sessions/today': SESSIONS_TODAY,
				'GET /sessions/s1/roster': ROSTER_S1,
				'GET /sessions/s2/roster': new Error('rate limited')
			})
		);

		const d = await getAttendance();

		expect(d.classes).toHaveLength(1);
		expect(d.classes[0].id).toBe('s1');
		expect(d.classes[0].roster).toHaveLength(2); // 成功場次名冊完整可操作
		expect(d.failedClasses).toEqual(['青少年體操中級班']);
	});

	it('全部名冊都失敗時整體拋出(頁面走 error state 可重試，而非誤導性空狀態)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME,
				'GET /coaches': [MY_COACH],
				'GET /sessions/today': SESSIONS_TODAY,
				'GET /sessions/s1/roster': new Error('boom 1'),
				'GET /sessions/s2/roster': new Error('boom 2')
			})
		);

		await expect(getAttendance()).rejects.toThrow('boom 1');
	});

	it('今日沒有場次時 classes 為空陣列(頁面顯示空狀態)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [MY_COACH], 'GET /sessions/today': [] })
		);

		const d = await getAttendance();
		expect(d.classes).toEqual([]);
		expect(d.failedClasses).toEqual([]);
	});

	it('myCoachProfile 找不到教練時拋出 CoachNotFoundError', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /users/me': ME, 'GET /coaches': [OTHER_COACH] })
		);
		await expect(getAttendance()).rejects.toThrow(CoachNotFoundError);
	});
});

describe('saveAttendance — PUT /sessions/{id}/attendance（§3.19）', () => {
	it('送出 { records: [{ enrolment_id, status }] }；late(遲到)併入 present', async () => {
		const UPDATED_ROSTER = [
			{ enrolment_id: 'en-1', user_id: 'u1', user_name: '王小明', attendance_status: 'present' }
		];
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /sessions/s1/attendance': UPDATED_ROSTER }));

		const result = await saveAttendance('s1', { 'en-1': 'present', 'en-2': 'late', 'en-3': 'leave', 'en-4': 'absent' });

		expect(api).toHaveBeenCalledWith('/sessions/s1/attendance', {
			method: 'PUT',
			body: JSON.stringify({
				records: [
					{ enrolment_id: 'en-1', status: 'present' },
					{ enrolment_id: 'en-2', status: 'present' }, // late → present
					{ enrolment_id: 'en-3', status: 'leave' },
					{ enrolment_id: 'en-4', status: 'absent' }
				]
			})
		});
		expect(result).toEqual([
			{ n: '01', name: '王小明', initial: '王', color: '#0066CC', mid: 'en-1', def: 'present' }
		]);
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PUT /sessions/s1/attendance': [] }));
		expect(saveAttendance('s1', {})).toBeInstanceOf(Promise);
	});
});

/* Task 12：訊息中心（GET /conversations/me + GET .../messages + POST .../messages +
 * PATCH .../read，§3.21）。角色規則保證對話一端 coach、一端 member——CONTEXT.md 明定
 * 「會員」帳號即學員本人、不分家長/學員(Avoid: 家長)，故 kind 一律映射'會員'；
 * urgent/sla/slaTone 無資料來源，皆為不觸發顯示的誠實預設值(P2)。 */
const ME2 = {
	id: 'u9', email: 'chen@dreamfly.com.tw', name: '陳雅婷',
	phone: null, last_login: null, created_at: '2020-01-01T00:00:00Z'
};

describe('getConversations — GET /conversations/me（§3.21，純陣列不分頁）', () => {
	it('映射 peer_name/last_message_body/last_message_at/unread_count；kind 一律"會員"；保留伺服器排序', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /conversations/me': [
					{ id: 'c1', peer_id: 'u1', peer_name: '王小明', last_message_body: '老師您好', last_message_at: '2026-07-05T09:42:00Z', unread_count: 2 },
					{ id: 'c2', peer_id: 'u2', peer_name: '陳小華', last_message_body: null, last_message_at: null, unread_count: 0 }
				]
			})
		);

		const d = await getConversations();

		expect(d.conversations).toEqual([
			{
				id: 'c1', name: '王小明', initial: '王', color: '#0066CC', kind: '會員',
				time: '2026-07-05 09:42', badge: 2, preview: '老師您好', sla: '', slaTone: 'muted'
			},
			{
				id: 'c2', name: '陳小華', initial: '陳', color: '#0066CC', kind: '會員',
				time: '', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted'
			}
		]);
	});

	it('沒有對話時回傳空陣列', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': [] }));
		const d = await getConversations();
		expect(d.conversations).toEqual([]);
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /conversations/me': [] }));
		expect(getConversations()).toBeInstanceOf(Promise);
	});
});

describe('getThread — GET /conversations/{id}/messages?per_page=100（§3.21，同 getPendingLeaveRequests 的 per_page=100 穿透模式）', () => {
	it('who 由 sender_id 與 GET /users/me 比對；API 依 created_at 新到舊，映射後反轉為舊到新；total 穿透', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME2,
				'GET /conversations/c1/messages?per_page=100': {
					messages: [
						{ id: 'm2', sender_id: 'u9', body: '好的，謝謝老師', created_at: '2026-07-05T09:16:00Z', read_at: null },
						{ id: 'm1', sender_id: 'u1', body: '老師您好', created_at: '2026-07-05T09:10:00Z', read_at: '2026-07-05T09:11:00Z' }
					],
					total: 2, page: 1, per_page: 100
				}
			})
		);

		const d = await getThread('c1');

		expect(d.messages).toEqual([
			{ who: 'them', text: '老師您好', time: '2026-07-05 09:10' },
			{ who: 'me', text: '好的，謝謝老師', time: '2026-07-05 09:16' }
		]);
		expect(d.total).toBe(2);
	});

	it('total 大於本頁筆數時原樣穿透（伺服器端總數，較舊訊息被截斷）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME2,
				'GET /conversations/c1/messages?per_page=100': {
					messages: [{ id: 'm1', sender_id: 'u1', body: '嗨', created_at: '2026-07-05T09:10:00Z', read_at: null }],
					total: 150, page: 1, per_page: 100
				}
			})
		);

		const d = await getThread('c1');

		expect(d.messages).toHaveLength(1);
		expect(d.total).toBe(150);
	});

	it('沒有訊息時回傳空陣列', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME2,
				'GET /conversations/c1/messages?per_page=100': { messages: [], total: 0, page: 1, per_page: 100 }
			})
		);
		const d = await getThread('c1');
		expect(d.messages).toEqual([]);
		expect(d.total).toBe(0);
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /users/me': ME2,
				'GET /conversations/c1/messages?per_page=100': { messages: [], total: 0, page: 1, per_page: 100 }
			})
		);
		expect(getThread('c1')).toBeInstanceOf(Promise);
	});
});

describe('sendMessage — POST /conversations/{id}/messages（§3.21）', () => {
	it('送出 { body }；回應 sender_id 保證為呼叫者自己，直接映射 who="me"', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /conversations/c1/messages': {
					id: 'm3', sender_id: 'u9', body: '好的，明天見', created_at: '2026-07-05T09:20:00Z', read_at: null
				}
			})
		);

		const msg = await sendMessage('c1', '好的，明天見');

		expect(api).toHaveBeenCalledWith('/conversations/c1/messages', {
			method: 'POST',
			body: JSON.stringify({ body: '好的，明天見' })
		});
		expect(msg).toEqual({ who: 'me', text: '好的，明天見', time: '2026-07-05 09:20' });
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /conversations/c1/messages': { id: 'm1', sender_id: 'u9', body: 'x', created_at: '2026-07-05T09:20:00Z', read_at: null }
			})
		);
		expect(sendMessage('c1', 'x')).toBeInstanceOf(Promise);
	});
});

describe('markRead — PATCH /conversations/{id}/read（§3.21）', () => {
	it('無 body，回傳已讀則數', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /conversations/c1/read': { updated: 2 } }));

		const d = await markRead('c1');

		expect(api).toHaveBeenCalledWith('/conversations/c1/read', { method: 'PATCH' });
		expect(d).toEqual({ updated: 2 });
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /conversations/c1/read': { updated: 0 } }));
		expect(markRead('c1')).toBeInstanceOf(Promise);
	});
});

describe('createConversation — POST /conversations（§3.21，get-or-create）', () => {
	it('送出 { user_id }；回應與 peer 姓名映射為既有 Conversation 形狀(全新對話 last_message_at null → time 空字串、preview 尚無訊息)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /conversations': {
					id: 'cv1', member_id: 'u9', coach_id: 'u1',
					created_at: '2026-07-06T00:00:00Z', last_message_at: null
				}
			})
		);

		const convo = await createConversation('u9', '王小明');

		expect(api).toHaveBeenCalledWith('/conversations', {
			method: 'POST',
			body: JSON.stringify({ user_id: 'u9' })
		});
		expect(convo).toEqual({
			id: 'cv1', name: '王小明', initial: '王', color: '#0066CC', kind: '會員',
			time: '', badge: 0, preview: '尚無訊息', sla: '', slaTone: 'muted'
		});
	});

	it('get-or-create 回既有對話(last_message_at 非 null)時 time 正常轉換', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /conversations': {
					id: 'cv2', member_id: 'u9', coach_id: 'u1',
					created_at: '2026-07-01T00:00:00Z', last_message_at: '2026-07-05T09:42:00Z'
				}
			})
		);

		const convo = await createConversation('u9', '陳小華');

		expect(convo.id).toBe('cv2');
		expect(convo.time).toBe('2026-07-05 09:42');
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /conversations': {
					id: 'cv1', member_id: 'u9', coach_id: 'u1',
					created_at: '2026-07-06T00:00:00Z', last_message_at: null
				}
			})
		);
		expect(createConversation('u9', '王小明')).toBeInstanceOf(Promise);
	});
});

describe('getStudents — GET /coaches/me/students（§3.19）', () => {
	it('映射為 Student[]；user_id 穿透(訊息中心撰寫新對話 POST /conversations 需要)；courses 結構化穿透(含 enrolment_id，寫評語 POST /report-cards 需要)；cls 由 courses 陣列以「、」串接；level/skill/pct/att 皆為誠實預設值(P2)', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /coaches/me/students': [
					{ user_id: 'u1', name: '王小明', phone: '0912-000-000', courses: [{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en1' }] },
					{ user_id: 'u2', name: '陳小華', phone: null, courses: [
						{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en2' },
						{ course_id: 'c2', course_name: '競技選手班', enrolment_id: 'en3' }
					] }
				]
			})
		);

		const d = await getStudents();

		expect(d.students).toEqual([
			{
				user_id: 'u1', name: '王小明', initial: '王', color: '#0066CC', cls: '兒童體操初階班',
				courses: [{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en1' }],
				level: '初階', skill: '', pct: 0, att: 0
			},
			{
				user_id: 'u2', name: '陳小華', initial: '陳', color: '#0066CC', cls: '兒童體操初階班、競技選手班',
				courses: [
					{ course_id: 'c1', course_name: '兒童體操初階班', enrolment_id: 'en2' },
					{ course_id: 'c2', course_name: '競技選手班', enrolment_id: 'en3' }
				],
				level: '初階', skill: '', pct: 0, att: 0
			}
		]);
	});

	it('沒有學員時回傳空陣列', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /coaches/me/students': [] }));
		const d = await getStudents();
		expect(d.students).toEqual([]);
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'GET /coaches/me/students': [] }));
		expect(getStudents()).toBeInstanceOf(Promise);
	});
});

/* Task 11：請假審核（GET /leave-requests?status=pending + PATCH /leave-requests/{id}，
 * §3.20）。同 getStudents 慣例——無需 requireMyCoach() 閘門，呼叫者掛 coach 角色但查無
 * 對應 coaches 資料列時後端本身回空頁而非錯誤(§3.20 引用§3.18/§3.19既有慣例)。 */
describe('getPendingLeaveRequests — GET /leave-requests?status=pending&per_page=100（§3.20）', () => {
	// fakeRouter 對未交代的 key 一律丟錯——下列測試同時釘住「請求必須帶 per_page=100」
	// （後端預設 20 會截斷長清單）：若實作漏帶參數，key 不吻合直接紅。
	it('映射 leave_requests 分頁包裝為 CoachLeaveRequest[]（course_name/user_name/場次/事由/建立時間），total 穿透', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /leave-requests?status=pending&per_page=100': {
					leave_requests: [
						{
							id: 'lr-1', course_id: 'c1', course_name: '兒童體操初階班',
							user_id: 'u9', user_name: '王小明',
							session_id: 's1', session_date: '2026-07-10', start_time: '19:00:00',
							reason: '生病', status: 'pending',
							makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
							decided_at: null, created_at: '2026-07-01T00:00:00Z'
						}
					],
					total: 1, page: 1, per_page: 100
				}
			})
		);

		const d = await getPendingLeaveRequests();

		expect(d.requests).toEqual([
			{
				id: 'lr-1', course_name: '兒童體操初階班', user_name: '王小明',
				session_date: '2026-07-10', start_time: '19:00:00',
				reason: '生病', created_at: '2026-07-01T00:00:00Z'
			}
		]);
		expect(d.total).toBe(1);
	});

	it('total 大於本頁筆數時原樣穿透（伺服器端總數，不得以截斷後陣列長度頂替）', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'GET /leave-requests?status=pending&per_page=100': {
					leave_requests: [
						{
							id: 'lr-1', course_id: 'c1', course_name: '兒童體操初階班',
							user_id: 'u9', user_name: '王小明',
							session_id: 's1', session_date: '2026-07-10', start_time: '19:00:00',
							reason: null, status: 'pending',
							makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
							decided_at: null, created_at: '2026-07-01T00:00:00Z'
						}
					],
					total: 150, page: 1, per_page: 100
				}
			})
		);

		const d = await getPendingLeaveRequests();

		expect(d.requests).toHaveLength(1);
		expect(d.total).toBe(150);
	});

	it('沒有待審核假單時回傳空陣列與 total 0', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /leave-requests?status=pending&per_page=100': { leave_requests: [], total: 0, page: 1, per_page: 100 } })
		);
		const d = await getPendingLeaveRequests();
		expect(d.requests).toEqual([]);
		expect(d.total).toBe(0);
	});

	it('是 async 接縫(回 Promise)', () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'GET /leave-requests?status=pending&per_page=100': { leave_requests: [], total: 0, page: 1, per_page: 100 } })
		);
		expect(getPendingLeaveRequests()).toBeInstanceOf(Promise);
	});
});

describe('decideLeaveRequest — PATCH /leave-requests/{id}（§3.20）', () => {
	const API_RESPONSE = {
		id: 'lr-1', course_id: 'c1', course_name: '兒童體操初階班',
		user_id: 'u9', user_name: '王小明',
		session_id: 's1', session_date: '2026-07-10', start_time: '19:00:00',
		reason: '生病', status: 'approved',
		makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
		decided_at: '2026-07-02T00:00:00Z', created_at: '2026-07-01T00:00:00Z'
	};

	it('核准：送出 { status: "approved" }，回傳映射後的 CoachLeaveRequest', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'PATCH /leave-requests/lr-1': API_RESPONSE }));

		const d = await decideLeaveRequest('lr-1', 'approved');

		expect(api).toHaveBeenCalledWith('/leave-requests/lr-1', {
			method: 'PATCH',
			body: JSON.stringify({ status: 'approved' })
		});
		expect(d).toEqual({
			id: 'lr-1', course_name: '兒童體操初階班', user_name: '王小明',
			session_date: '2026-07-10', start_time: '19:00:00',
			reason: '生病', created_at: '2026-07-01T00:00:00Z'
		});
	});

	it('婉拒：送出 { status: "rejected" }', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /leave-requests/lr-1': { ...API_RESPONSE, status: 'rejected' } })
		);

		await decideLeaveRequest('lr-1', 'rejected');

		expect(api).toHaveBeenCalledWith('/leave-requests/lr-1', {
			method: 'PATCH',
			body: JSON.stringify({ status: 'rejected' })
		});
	});
});

describe('createReportCard — POST /report-cards（Task 13 續，§3.22）', () => {
	it('POSTs the given body as-is (含 rating) and returns the ReportCardResponse', async () => {
		const created = {
			id: 'rc-new', course_id: 'c1', course_name: '兒童體操初階班',
			term_label: '2026 夏季', comment: '進步很多', rating: 4,
			created_by_name: '林雅婷', created_at: '2026-07-07T00:00:00Z'
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': created }));

		const body = { enrolment_id: 'en1', term_label: '2026 夏季', comment: '進步很多', rating: 4 };
		const result = await createReportCard(body);

		expect(api).toHaveBeenCalledWith('/report-cards', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('rating 省略時 body 不含 rating 欄位', async () => {
		const created = {
			id: 'rc-new', course_id: 'c1', course_name: '兒童體操初階班',
			term_label: '2026 夏季', comment: '進步很多', rating: null,
			created_by_name: '林雅婷', created_at: '2026-07-07T00:00:00Z'
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /report-cards': created }));

		await createReportCard({ enrolment_id: 'en1', term_label: '2026 夏季', comment: '進步很多' });

		expect(api).toHaveBeenCalledWith('/report-cards', {
			method: 'POST',
			body: JSON.stringify({ enrolment_id: 'en1', term_label: '2026 夏季', comment: '進步很多' })
		});
	});

	it('propagates a rejected request (e.g. 409 重複期別) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /report-cards': new Error('此期別已建立過成績單') })
		);
		await expect(
			createReportCard({ enrolment_id: 'en1', term_label: '2026 夏季', comment: 'x' })
		).rejects.toThrow('此期別已建立過成績單');
	});
});

describe('createCertificate — POST /certificates（Task 13，§3.22）', () => {
	it('POSTs the given body as-is and returns the CertificateResponse', async () => {
		const created = {
			id: 'ct-new', course_id: null, course_name: null, title: '結業證書',
			level: '結業', issued_on: '2026-07-06', note: null, created_at: '2026-07-06T00:00:00Z'
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /certificates': created }));

		const body = { user_id: 'su01', title: '結業證書', level: '結業', issued_on: '2026-07-06' };
		const result = await createCertificate(body);

		expect(api).toHaveBeenCalledWith('/certificates', { method: 'POST', body: JSON.stringify(body) });
		expect(result).toEqual(created);
	});

	it('propagates a rejected request (e.g. 403 非自己課程學員 / 422 驗證) to the caller', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /certificates': new Error('僅能發給自己課程的學員') })
		);
		await expect(
			createCertificate({ user_id: 'su99', title: '結業證書', issued_on: '2026-07-06' })
		).rejects.toThrow('僅能發給自己課程的學員');
	});
});
