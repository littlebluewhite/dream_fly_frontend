/* 會員 app(手機)API 接縫。
 *
 * Task 19：從整包 reply() mock 改為 desktop member seams 的薄層——直接 import
 * `$lib/member/api.ts`(有的直接 re-export/passthrough，形狀完全相同時不重新
 * 宣告一次型別;有的做薄映射，僅在行動版形狀真的不同處，例如 catalog 課程卡
 * 需要一個真後端沒有的 icon 欄位)。凡是桌面 seam 本身仍是 mock(無後端來源)
 * 的欄位，這裡原樣沿用同一份 mock/預設值——不發明桌面沒有的假來源，也不重新
 * 實作桌面已經做過的映射邏輯。逐函式來源見 task-19-report.md 的盤點表。 */
import type { CatalogCourse } from '$lib/public/adapters';
// 刻意從 $lib/domain/member-app 取寬鬆版型別(tone/status 為 string，非窄化
// union)，不是 member/data.ts 的窄版——桌面 seam 回傳的窄型別值可以安全widen
// 進寬鬆型別(結構相容)，但反過來不行；mobile 既有呼叫端(overlay/測試 fixture)
// 一直以來都是對這個寬鬆版型別寫的，沿用它才不會逼既有呼叫端也跟著窄化。
import type { EnrolledCourse as MyCourse, Order, ScheduleBlock, Notification } from '$lib/domain/member-app';
import {
	getCourses as memberGetCourses,
	getMine as memberGetMine,
	getSchedule as memberGetSchedule,
	getAccount as memberGetAccount,
	getNotifications as memberGetNotifications,
	getPoints as memberGetPoints,
	getReports as memberGetReports,
	getReportStats as memberGetReportStats,
	type PointsData,
	type Reward,
	type ReportsData
} from '$lib/member/api';
import { ANNOUNCE, type Announce, type Course } from './data';

/** 課程分類 → icon。真後端 CatalogCourse(`$lib/public/adapters`)沒有 icon 欄位
 *  (courses 表本身不存這個欄位)——對照首頁/課程介紹頁既有 CATS 分類清單的圖示
 *  選擇(6 個分類皆已在別處驗證過是有效註冊的 icon 名稱)。未知分類(admin 可自
 *  由輸入 category 文字)一律給預設值，同 TrialScreen catIcon 的 fallback 慣例。 */
const CATEGORY_ICON: Record<string, string> = {
	幼兒體操: 'baby',
	兒童基礎: 'rotate-cw',
	競技啦啦隊: 'sparkles',
	競技體操: 'medal',
	成人體操: 'dumbbell',
	跑酷: 'flame'
};
const DEFAULT_COURSE_ICON = 'graduation-cap';

/** CatalogCourse → mobile Course：欄位逐一相同，只加 icon 薄映射。 */
function toMobileCourse(c: CatalogCourse): Course {
	return { ...c, icon: CATEGORY_ICON[c.cat] ?? DEFAULT_COURSE_ICON };
}

export interface MobileHomeData {
	catalog: Course[];
	announce: Announce[];
	myCourses: MyCourse[];
}

/** 首頁 — catalog 復用桌面 getCourses()(GET /courses + GET /coaches join，只加
 *  icon 薄映射)；myCourses 復用桌面 getMine().courses(EnrolledCourse 形狀兩側
 *  同源，零映射)。兩者互不相依，平行拉取。
 *  // P2: announce(最新公告)後端無對應資料源，沿用 mock —— 同桌面 getDashboard()
 *  對 announce 的決定(桌面也是原樣顯示 mock、不隱藏)，此處鏡射該決定。 */
export const getHome = async (): Promise<MobileHomeData> => {
	const [{ catalog }, { courses }] = await Promise.all([memberGetCourses(), memberGetMine()]);
	return { catalog: catalog.map(toMobileCourse), announce: ANNOUNCE, myCourses: courses };
};

export interface MobileCoursesData {
	catalog: Course[];
}

/** 課程介紹 — 復用桌面 getCourses()，同 getHome() 的 catalog 映射。 */
export const getCourses = async (): Promise<MobileCoursesData> => {
	const { catalog } = await memberGetCourses();
	return { catalog: catalog.map(toMobileCourse) };
};

export interface MineData {
	courses: MyCourse[];
	schedule: ScheduleBlock[];
	attendanceRate: number | null; // GET /reports/me attendance_rate 原樣透傳；null(無出勤資料，
	                                // 裁決 3)時顯示層(mine/+page.svelte)渲染「—」，不是 0%
	upcomingSessions7d: number; // 7 日內場次
	attendedTotal: number; // 累計出席
}

/** 我的課程 — courses 復用桌面 getMine().courses；schedule 復用桌面
 *  getSchedule().schedule(Task 9 週課表 seam);stats 復用桌面 getReportStats()
 *  (GET /reports/me,§3.24)。三者互不相依，平行拉取。
 *  原 streak(連續到課)/skillsMastered(已掌握技巧)後端無對應概念(無「連續到課
 *  天數」「技巧掌握度」欄位)，換成後端真有的 upcomingSessions7d/attendedTotal
 *  兩個欄位(UI 卡片標籤同步改為「7 日內場次」/「累計出席」，見 mine/+page.svelte)。 */
export const getMine = async (): Promise<MineData> => {
	const [{ courses }, { schedule }, stats] = await Promise.all([
		memberGetMine(),
		memberGetSchedule(),
		memberGetReportStats()
	]);
	return {
		courses,
		schedule,
		attendanceRate: stats.attendanceRate,
		upcomingSessions7d: stats.upcomingSessions7d,
		attendedTotal: stats.attendedTotal
	};
};

export interface MobileAccountData {
	orders: Order[];
}

/** 帳戶 — 復用桌面 getAccount().orders(GET /users/me + GET /orders/me；桌面
 *  getAccount() 內部已 side-effect 呼叫 refreshPoints()/refreshSubscriptions()，
 *  讓帳戶頁的 $points 一開始就是真資料——見 member/api.ts getAccount() 註解)。
 *  本頁不需要 profile 欄位(行動版帳戶頁的個人資料仍是本地 profile store，見
 *  mobile/stores.ts 的既有慣例，非本任務範圍)，只取 orders。 */
export const getAccount = async (): Promise<MobileAccountData> => {
	const { orders } = await memberGetAccount();
	return { orders };
};

/** 通知中心 feed — 復用桌面 getNotifications()(GET /notifications)，零映射
 *  (Notification 形狀兩側同源)。 */
export const getNotifications = (): Promise<Notification[]> => memberGetNotifications();

export interface ScheduleData {
	schedule: ScheduleBlock[];
}

/** 完整日程 push screen(ScheduleScreen)— 復用桌面 getSchedule()(GET
 *  /schedule/me，Task 9 週課表 seam)，零映射。 */
export const getSchedule = (): Promise<ScheduleData> => memberGetSchedule();

export type { PointsData, Reward };

/** 會員點數 push screen(PointsScreen)— 復用桌面 getPoints()(GET /rewards，
 *  Task 14 rewards seam)，零映射。桌面 getPoints() 內部已呼叫 refreshPoints()
 *  整包水合 points/pointsLedger store——PointsScreen 直接讀 `$lib/member/stores`
 *  的 points/pointsLedger(不是這裡的回傳值)，兌換動作也走同一個 store 的
 *  redeemReward()(同桌面「動作留在 stores.ts、取資料留在 api.ts」的慣例)。
 *  // P2: expiring(即將到期點數)/expiryDate(到期日)後端無點數到期排程，
 *  桌面本身也是硬編這兩個字串——原樣透傳，不重新硬編一份。 */
export const getPoints = (): Promise<PointsData> => memberGetPoints();

export type { ReportsData };

/** 成績單與證書 push screen(ReportScreen)— 復用桌面 getReports()(GET
 *  /report-cards/me + GET /certificates/me + GET /reports/me，Task 13 seam)，
 *  零映射。真後端成績單只有 comment/rating/term_label 三個欄位，沒有 mock 舊版
 *  的「評等字母/技巧熟練度百分比/學習表現雷達圖」——ReportScreen 已改為列表
 *  呈現每一筆成績單(同桌面 /member/reports 頁的呈現方式)，不再顯示這些後端
 *  沒有的欄位。 */
export const getReports = (): Promise<ReportsData> => memberGetReports();
