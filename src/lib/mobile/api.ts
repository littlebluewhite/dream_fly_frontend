/* 會員 app(手機)mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { CATALOG, ANNOUNCE, MY_COURSES, SCHEDULE, ORDERS, NOTIFS_SEED } from './data';
import type { Course, Announce, MyCourse, ScheduleBlock, Order, NotifItem } from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 「我的報名課程」單一內部存取點;未來 fetch 只改此處。 */
const myCourses = (): MyCourse[] => MY_COURSES;

export interface MobileHomeData {
	catalog: Course[];
	announce: Announce[];
	myCourses: MyCourse[];
}
export const getHome = (): Promise<MobileHomeData> =>
	reply({ catalog: CATALOG, announce: ANNOUNCE, myCourses: myCourses() });

export interface MobileCoursesData {
	catalog: Course[];
}
export const getCourses = (): Promise<MobileCoursesData> => reply({ catalog: CATALOG });

/** 摘要統計(本月出席率/連續到課/已掌握技巧)原為頁面硬編字串,一併移入接縫
 *  (比照 coach getDashboard 的 KPI 字串前例)。 */
export interface MineData {
	courses: MyCourse[];
	schedule: ScheduleBlock[];
	attendanceRate: string;
	streak: string;
	skillsMastered: string;
}
export const getMine = (): Promise<MineData> =>
	reply({
		courses: myCourses(),
		schedule: SCHEDULE,
		attendanceRate: '95%',
		streak: '14',
		skillsMastered: '8'
	});

export interface MobileAccountData {
	orders: Order[];
}
export const getAccount = (): Promise<MobileAccountData> => reply({ orders: ORDERS });

/** 通知 feed(store-getter,非包物件)。與 stores.ts 同源、同樣 clone。 */
export const getNotifications = (): Promise<NotifItem[]> => reply(NOTIFS_SEED.map((n) => ({ ...n })));
