import { describe, it, expect } from 'vitest';
import { getHome, getCourses, getMine, getAccount, getNotifications } from './api';
import { CATALOG, ANNOUNCE, MY_COURSES, SCHEDULE, ORDERS, NOTIFS_SEED } from './data';

describe('mobile/api', () => {
	it('getHome 回傳整包首頁資料', async () => {
		const d = await getHome();
		expect(d).toEqual({ catalog: CATALOG, announce: ANNOUNCE, myCourses: MY_COURSES });
	});
	it('getHome 是 async 接縫(回 Promise)', () => {
		expect(getHome()).toBeInstanceOf(Promise);
	});

	it('getCourses 回傳整包課程介紹資料', async () => {
		const d = await getCourses();
		expect(d).toEqual({ catalog: CATALOG });
	});
	it('getCourses 是 async 接縫(回 Promise)', () => {
		expect(getCourses()).toBeInstanceOf(Promise);
	});

	it('getMine 回傳整包我的課程資料(含摘要統計硬編字串)', async () => {
		const d = await getMine();
		expect(d).toEqual({
			courses: MY_COURSES,
			schedule: SCHEDULE,
			attendanceRate: '95%',
			streak: '14',
			skillsMastered: '8'
		});
	});
	it('getMine 是 async 接縫(回 Promise)', () => {
		expect(getMine()).toBeInstanceOf(Promise);
	});

	it('getAccount 回傳整包帳戶資料', async () => {
		const d = await getAccount();
		expect(d).toEqual({ orders: ORDERS });
	});
	it('getAccount 是 async 接縫(回 Promise)', () => {
		expect(getAccount()).toBeInstanceOf(Promise);
	});

	it('getNotifications 回傳整包通知資料(= NOTIFS_SEED)', async () => {
		const d = await getNotifications();
		expect(d).toEqual(NOTIFS_SEED);
	});
	it('getNotifications 是 async 接縫(回 Promise)', () => {
		expect(getNotifications()).toBeInstanceOf(Promise);
	});
});
