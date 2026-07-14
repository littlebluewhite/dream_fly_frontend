/* 會員 app(手機)API 接縫。
 *
 * Task 19：從整包 reply() mock 改為 desktop member seams 的薄層——直接 import
 * `$lib/member/api.ts`(有的直接 re-export/passthrough，形狀完全相同時不重新
 * 宣告一次型別;有的做薄映射，僅在行動版形狀真的不同處，例如 catalog 課程卡
 * 需要一個真後端沒有的 icon 欄位)。凡是桌面 seam 本身仍是 mock(無後端來源)
 * 的欄位，這裡原樣沿用同一份 mock/預設值——不發明桌面沒有的假來源，也不重新
 * 實作桌面已經做過的映射邏輯。逐函式來源見 task-19-report.md 的盤點表。 */
import type { CatalogCourse } from '$lib/public/adapters';
import { api } from '$lib/api/client';
import { sendContactInquiry, type ApiInquiry } from '$lib/public/api';
// 刻意從 $lib/domain/member-app 取寬鬆版型別(tone/status 為 string，非窄化
// union)，不是 member/data.ts 的窄版——桌面 seam 回傳的窄型別值可以安全widen
// 進寬鬆型別(結構相容)，但反過來不行；mobile 既有呼叫端(overlay/測試 fixture)
// 一直以來都是對這個寬鬆版型別寫的，沿用它才不會逼既有呼叫端也跟著窄化。
import type { EnrolledCourse as MyCourse, Order, ScheduleBlock, Notification, AttRecord } from '$lib/domain/member-app';
import {
	getCourses as memberGetCourses,
	getMine as memberGetMine,
	getSchedule as memberGetSchedule,
	getAccount as memberGetAccount,
	getNotifications as memberGetNotifications,
	getPoints as memberGetPoints,
	getReports as memberGetReports,
	getReportStats as memberGetReportStats,
	getEnrolmentAttendance as memberGetEnrolmentAttendance,
	type PointsData,
	type Reward,
	type ReportsData
} from '$lib/member/api';
import { ANNOUNCE, type Announce, type Course } from './data';
import { PREFS_DEFAULT, type Prefs } from './stores';
import type { IconName } from '$lib/icon-registry';

/** 課程分類 → icon。真後端 CatalogCourse(`$lib/public/adapters`)沒有 icon 欄位
 *  (courses 表本身不存這個欄位)——對照首頁/課程介紹頁既有 CATS 分類清單的圖示
 *  選擇(6 個分類皆已在別處驗證過是有效註冊的 icon 名稱)。未知分類(admin 可自
 *  由輸入 category 文字)一律給預設值，同 TrialScreen catIcon 的 fallback 慣例。 */
const CATEGORY_ICON: Record<string, IconName> = {
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

/** 出席紀錄(Task F7 沿用；§3.12)— 復用桌面 getEnrolmentAttendance()(GET
 *  /enrolments/{id}/attendance)，零映射(AttRecord 形狀兩側同源)。W3 收編：
 *  原為 MyCourseDetail.svelte 直穿 member/api 的唯一 data getter，收編對齊
 *  mobile-admin 零直穿紀律，不再由呼叫端自己 import 桌面 seam。 */
export const getEnrolmentAttendance = (id: string): Promise<AttRecord[]> =>
	memberGetEnrolmentAttendance(id);

/* ---- 試上預約(TrialScreen)送出 — Task F8：POST /contact, inquiry_type='trial' ----
 * 復用桌面 sendContactInquiry()(§3.17),不重新實作一次 HTTP。設計=洽詢特化:
 * 不佔名額、不建 booking,admin 後續以簡訊/電話人工聯繫(見 TrialScreen 既有
 * NoteBox 文案),故頂層 phone 才是真正會被使用的聯絡管道。契約頂層 email 為
 * 必填欄位,但試上表單本身未收集 email——用可辨識的預設值佔位,不為此新增
 * 表單欄位(對照組決策與映射表見 task-F8-report.md)。subject/message 組成人類
 * 可讀摘要,讓 admin 列表不必展開 metadata 就看得懂;metadata 帶齊契約 §3.17
 * 文件性列舉的 8 個 trial 慣例欄位,供之後需要結構化讀取時使用。 */
const TRIAL_INQUIRY_EMAIL_PLACEHOLDER = 'trial-inquiry@no-email.dreamfly.local';

export interface TrialInquiryInput {
	category: string;
	studentAge: string;
	preferredDay: string;
	preferredSlot: string;
	parentName: string;
	parentPhone: string;
	studentName: string;
	note: string;
}

export const submitTrialInquiry = (input: TrialInquiryInput): Promise<ApiInquiry> =>
	sendContactInquiry({
		name: input.parentName,
		email: TRIAL_INQUIRY_EMAIL_PLACEHOLDER,
		phone: input.parentPhone,
		subject: `試上預約:${input.category}`,
		message: [
			`課程類別：${input.category}`,
			`學員年齡：${input.studentAge}`,
			`預約時段：${input.preferredDay} ${input.preferredSlot}`,
			`家長姓名：${input.parentName}`,
			`聯絡手機：${input.parentPhone}`,
			`學員姓名：${input.studentName}`,
			`備註：${input.note || '無'}`
		].join('\n'),
		inquiry_type: 'trial',
		metadata: {
			category: input.category,
			student_age: input.studentAge,
			preferred_day: input.preferredDay,
			preferred_slot: input.preferredSlot,
			parent_name: input.parentName,
			parent_phone: input.parentPhone,
			student_name: input.studentName,
			note: input.note
		}
	});

/* ---- 帳戶設定(SettingsScreen)偏好持久化 — Task F10：users.preferences(B7；
 * integration-contract.md §3.2)整包覆寫語意 ----
 * GET /users/me 已回 preferences(object|null，未設定過為 null)；PATCH /users/me
 * 的 preferences 欄位帶了就整個取代、不做深合併、不逐 key 驗證(契約原文)。慣例
 * key(僅文件性列舉，後端不驗證其形狀)：class_reminder/coach_msg/promo/dark，
 * 對應 mobile/stores.ts 既有 Prefs 的四個布林開關——這裡只做 snake_case⇄
 * camelCase 映射；null 或缺 key 時的預設值直接沿用 Prefs store 既有初始值(見
 * 該檔案 `prefs` 宣告)，不是這裡新發明的規則。savePreferences 永遠送滿四個
 * key 的整包物件、不送 `preferences: null`——後端這欄位是單一 Option 語意，
 * 顯式 null 等同不帶(維持原值不動，不是清空)，跟這裡「整包覆寫」的既有用法
 * 無關，但也表示這裡不能拿 null 當清空路徑用(本來就沒有清空需求)。 */
interface ApiUserPreferences {
	preferences: Partial<Record<'class_reminder' | 'coach_msg' | 'promo' | 'dark', boolean>> | null;
}

function mapPreferences(raw: ApiUserPreferences['preferences']): Prefs {
	return {
		classReminder: raw?.class_reminder ?? PREFS_DEFAULT.classReminder,
		coachMsg: raw?.coach_msg ?? PREFS_DEFAULT.coachMsg,
		promo: raw?.promo ?? PREFS_DEFAULT.promo,
		dark: raw?.dark ?? PREFS_DEFAULT.dark
	};
}

/** GET /users/me — SettingsScreen 開啟時載入，用來覆蓋本地 prefs store 快取
 *  (本地 store 本身仍是載入前/離線時的顯示來源，見該畫面 onMount 呼叫端)。 */
export const getPreferences = async (): Promise<Prefs> => {
	const user = await api<ApiUserPreferences>('/users/me');
	return mapPreferences(user.preferences);
};

/** PATCH /users/me { preferences } — 切換開關時整包覆寫四個慣例 key(呼叫端
 *  負責組出切換後的完整 Prefs，見 SettingsScreen 的 setPref())。 */
export const savePreferences = (p: Prefs): Promise<void> =>
	api<ApiUserPreferences>('/users/me', {
		method: 'PATCH',
		body: JSON.stringify({
			preferences: {
				class_reminder: p.classReminder,
				coach_msg: p.coachMsg,
				promo: p.promo,
				dark: p.dark
			}
		})
	}).then(() => undefined);
