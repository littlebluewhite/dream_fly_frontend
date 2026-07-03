import { describe, it, expect } from 'vitest';
import {
	getDashboard,
	getToday,
	getAttendance,
	getSchedule,
	getMessages,
	getStudents,
	getSettings
} from './api';
import {
	COACH,
	TODAY_LABEL,
	TODAY_CLASSES,
	CONVERSATIONS,
	ATT_TODAY_CLASSES,
	SCHED_COURSES,
	STUDENTS,
	MSG_DIRECTORY,
	THREAD,
	SHARED_FILES
} from './data';

describe('coach/api', () => {
	it('getDashboard 回傳整包首頁資料(含 KPI 硬編字串)', async () => {
		const d = await getDashboard();
		expect(d).toEqual({
			coach: COACH,
			todayLabel: TODAY_LABEL,
			todayClasses: TODAY_CLASSES,
			conversations: CONVERSATIONS,
			pendingClasses: '2 班',
			attendanceRate: '92%',
			pendingReplies: '3 則'
		});
	});
	it('getDashboard 是 async 接縫(回 Promise)', () => {
		expect(getDashboard()).toBeInstanceOf(Promise);
	});

	it('getToday 回傳今日課表資料', async () => {
		const d = await getToday();
		expect(d).toEqual({ todayLabel: TODAY_LABEL, todayClasses: TODAY_CLASSES });
	});
	it('getToday 是 async 接縫(回 Promise)', () => {
		expect(getToday()).toBeInstanceOf(Promise);
	});

	it('getAttendance 回傳整包點名資料', async () => {
		const d = await getAttendance();
		expect(d).toEqual({ classes: ATT_TODAY_CLASSES });
	});
	it('getAttendance 是 async 接縫(回 Promise)', () => {
		expect(getAttendance()).toBeInstanceOf(Promise);
	});

	it('getSchedule 回傳整包排課資料', async () => {
		const d = await getSchedule();
		expect(d).toEqual({ courses: SCHED_COURSES });
	});
	it('getSchedule 是 async 接縫(回 Promise)', () => {
		expect(getSchedule()).toBeInstanceOf(Promise);
	});

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

	it('getStudents 回傳整包學員資料', async () => {
		const d = await getStudents();
		expect(d).toEqual({ students: STUDENTS });
	});
	it('getStudents 是 async 接縫(回 Promise)', () => {
		expect(getStudents()).toBeInstanceOf(Promise);
	});

	it('getSettings 回傳教練本人資料', async () => {
		const d = await getSettings();
		expect(d).toEqual({ coach: COACH });
	});
	it('getSettings 是 async 接縫(回 Promise)', () => {
		expect(getSettings()).toBeInstanceOf(Promise);
	});
});
