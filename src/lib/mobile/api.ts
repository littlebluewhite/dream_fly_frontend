/* 會員 app(手機)API 接縫。
 *
 * Task 19：從整包 reply() mock 改為 desktop member seams 的薄層——直接 import
 * `$lib/member/api.ts`(有的直接 re-export/passthrough，形狀完全相同時不重新
 * 宣告一次型別;有的做薄映射，僅在行動版形狀真的不同處，例如 catalog 課程卡
 * 需要一個真後端沒有的 icon 欄位)。凡是桌面 seam 本身仍是 mock(無後端來源)
 * 的欄位，這裡原樣沿用同一份 mock/預設值——不發明桌面沒有的假來源，也不重新
 * 實作桌面已經做過的映射邏輯。逐函式來源見 task-19-report.md 的盤點表。 */
import type { CatalogCourse } from '$lib/public/adapters';
import { sendContactInquiry, type ApiInquiry } from '$lib/public/api';
// 刻意從 $lib/domain/member-app 取寬鬆版型別(tone/status 為 string，非窄化
// union)，不是 member/data.ts 的窄版——桌面 seam 回傳的窄型別值可以安全widen
// 進寬鬆型別(結構相容)，但反過來不行；mobile 既有呼叫端(overlay/測試 fixture)
// 一直以來都是對這個寬鬆版型別寫的，沿用它才不會逼既有呼叫端也跟著窄化。
import type { EnrolledCourse as MyCourse, ScheduleBlock } from '$lib/domain/member-app';
import {
	getCourses as memberGetCourses,
	getMine as memberGetMine,
	getSchedule as memberGetSchedule,
	getReportStats as memberGetReportStats
} from '$lib/member/api';
import { ANNOUNCE, type Announce, type Course } from './data';
import { courseCategoryIcon } from '$lib/domain/course-category';

/** CatalogCourse → mobile Course：欄位逐一相同，只加 icon 薄映射。 */
function toMobileCourse(c: CatalogCourse): Course {
	return { ...c, icon: courseCategoryIcon(c.cat) };
}

export interface MobileHomeData {
	catalog: Course[];
	announce: Announce[];
}

/** 首頁 — catalog 復用桌面 getCourses()(GET /courses + GET /coaches join，只加
 *  icon 薄映射)。R16 Task 2c：首頁唯一讀報名課程的「下一堂課」卡已拿掉，不再順手
 *  拉 getMine()。
 *  // P2: announce(最新公告)後端無對應資料源，沿用 mock —— 同桌面 getDashboard()
 *  對 announce 的決定(桌面也是原樣顯示 mock、不隱藏)，此處鏡射該決定。 */
export const getHome = async (): Promise<MobileHomeData> => {
	const { catalog } = await memberGetCourses();
	return { catalog: catalog.map(toMobileCourse), announce: ANNOUNCE };
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
