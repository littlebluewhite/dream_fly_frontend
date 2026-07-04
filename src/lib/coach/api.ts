/* 教練工作台 API 接縫。Task 19：getDashboard/getToday/getSchedule/getSettings 換真後端
 * 資料 + saveSettings 新增；getAttendance/getMessages/getStudents 沒有對應後端端點，
 * 整包沿用 mock（P2，各自附註）。回傳「形狀」盡量維持不變，頁面不用重寫樣板。
 *
 * myCoachProfile()：GET /users/me → GET /coaches → find(user_id === me.id) 是本檔案
 * 的核心（登入的使用者本人就是教練，教練姓名只能從 users.name 來，見 integration-
 * contract.md §3.4 附註）。找不到對應教練檔案時，getDashboard/getToday/getSchedule/
 * getSettings 一律拋出 CoachNotFoundError，頁面 catch 用 e.name 判斷（不是 instanceof
 * —— 頁面測試把 $lib/coach/api 整支模組換成只有單一 getter 的假模組，import 進來的
 * class 會是 undefined，instanceof undefined 會炸掉），改顯示「此帳號未綁定教練檔案」。 */
import { api } from '$lib/api/client';
import { listCoaches, listCourses } from '$lib/public/api';
import type { ApiCoach, ApiCourse } from '$lib/public/api';
import {
	TODAY_LABEL,
	CONVERSATIONS,
	ATT_TODAY_CLASSES,
	STUDENTS,
	MSG_DIRECTORY,
	THREAD,
	SHARED_FILES
} from './data';
import type {
	Coach,
	TodayClass,
	TodayLevel,
	SchedCat,
	Conversation,
	AttClassFull,
	SchedCourse,
	Student,
	MsgRecipient,
	ThreadMsg,
	SharedFile
} from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。getAttendance/getMessages/getStudents
 *  仍沿用此 helper。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** myCoachProfile() 找不到對應教練檔案時拋出；UI 顯示「此帳號未綁定教練檔案」。 */
export class CoachNotFoundError extends Error {
	constructor() {
		super('此帳號未綁定教練檔案');
		this.name = 'CoachNotFoundError';
	}
}

/* ═════════════════════════ 教練本人（GET /users/me + GET /coaches） ═════════════════════════ */

/** UserResponse 只取用得到的欄位（同 member/api.ts 的窄化 local 慣例）。 */
interface ApiUser {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	last_login: string | null;
	created_at: string;
}

async function fetchMe(): Promise<{ user: ApiUser; coach: ApiCoach | null }> {
	const [user, coaches] = await Promise.all([api<ApiUser>('/users/me'), listCoaches()]);
	return { user, coach: coaches.find((c) => c.user_id === user.id) ?? null };
}

export async function myCoachProfile(): Promise<ApiCoach | null> {
	return (await fetchMe()).coach;
}

async function requireMyCoach(): Promise<{ user: ApiUser; coach: ApiCoach }> {
	const { user, coach } = await fetchMe();
	if (!coach) throw new CoachNotFoundError();
	return { user, coach };
}

/** GET /users/me + myCoachProfile() 組合成既有 Coach 形狀，getDashboard/getSettings 共用。
 *  name/display/full/initial 由 user.name 推導（東亞姓名慣例：首字視為姓氏，同 mock 原始
 *  資料「李志偉」→「李教練」/「李志偉 教練」的推導方式一致）；role/bio/chips 來自
 *  ApiCoach 的 title/bio/certifications；id 改用教練真實 uuid（舊「DF-C2019-007」員編
 *  格式後端無對應欄位，P2）；en/gender/birth/emergency 後端無對應欄位，誠實給空字串
 *  （P2）；registered 用 coach.created_at；lastLogin 用 user.last_login。 */
function mapCoach(user: ApiUser, coach: ApiCoach): Coach {
	const surname = user.name.charAt(0) || '?';
	return {
		name: user.name,
		display: `${surname}教練`,
		full: `${user.name} 教練`,
		en: '', // P2: 後端無英文姓名欄位
		initial: surname,
		// Task 4 判斷：CoachResponse 新增的 name 欄位在此不適用 —— name/display/full/
		// initial 已經正確取自 user.name(教練本人的真實姓名，見上方函式註解)；role 這裡
		// 語意上是「職稱」(routes/coach/settings 渲染成「{role} · {id}」的職銜列)，不是
		// 姓名欄位，繼續用 coach.title 才是對的欄位，不需要也不應該改成 coach.name。
		role: coach.title,
		id: coach.id, // P2: 舊員編格式(DF-C2019-007)無對應欄位，改用教練 uuid
		email: user.email,
		phone: user.phone ?? '',
		gender: '', // P2: 後端無性別欄位
		birth: '', // P2: 後端無生日欄位
		emergency: '', // P2: 後端無緊急聯絡人欄位
		bio: coach.bio ?? '',
		chips: coach.certifications,
		registered: coach.created_at.slice(0, 10),
		lastLogin: user.last_login ? user.last_login.slice(0, 16).replace('T', ' ') : ''
	};
}

/* ═════════════════════════ 今日課程 / 儀表板（GET /courses，過濾 coach_id） ═════════════════════════ */

/** schedule_text 實測格式為 "週二、四 16:00-17:00"（day-part 與 time-part 以第一個空白
 *  分隔，time-part 再以 '-' 拆出 start/end；同 admin/api.ts mapCourse 對此欄位的解析
 *  慣例，這裡另存一份小 helper，避免為了共用而改動 admin 自己的檔案）。null 或找不到
 *  對應分隔者，start/end 一律回空字串。 */
function splitTimeRange(text: string | null): { start: string; end: string } {
	if (!text) return { start: '', end: '' };
	const sp = text.indexOf(' ');
	const timePart = sp === -1 ? text : text.slice(sp + 1);
	const dash = timePart.indexOf('-');
	return dash === -1 ? { start: '', end: '' } : { start: timePart.slice(0, dash), end: timePart.slice(dash + 1) };
}

/** CourseResponse.level 只有 3 級，對照到 TodayLevel 的其中 3 個可用值（同 member/
 *  api.ts COURSE_LEVEL_LABEL 用字；啟蒙/基礎兩級後端無法還原，一律不會出現）。 */
const COURSE_LEVEL_TO_TODAY_LEVEL: Record<string, TodayLevel> = {
	beginner: '初級',
	intermediate: '中級',
	advanced: '高級'
};

/** category 實測值為「體操/啦啦/跑酷」（見 backend seed.rs），與 SchedCat 的「體操/
 *  啦啦隊/跑酷」不完全同字（啦啦 vs 啦啦隊），需要對照表而非直接 cast；其餘/未知值
 *  一律預設體操。 */
const CATEGORY_TO_SCHED_CAT: Record<string, SchedCat> = {
	體操: '體操',
	啦啦: '啦啦隊',
	跑酷: '跑酷'
};
function toSchedCat(category: string | null): SchedCat {
	return (category && CATEGORY_TO_SCHED_CAT[category]) || '體操'; // P2: 未知類別預設體操
}

/** CourseResponse → 既有 TodayClass 形狀。room 無對應欄位（同 admin/api.ts mapCourse）；
 *  count 用 enrolled_count；status 後端無「今日即時狀態」概念（courses 是課程定義，非
 *  當日實際場次），一律預設 wait（尚未開始，最中性的預設）。 */
function mapTodayClass(c: ApiCourse): TodayClass {
	const { start, end } = splitTimeRange(c.schedule_text);
	return {
		id: c.id,
		start,
		end,
		name: c.name,
		room: '', // P2: CourseResponse 無場地欄位
		count: c.enrolled_count,
		level: COURSE_LEVEL_TO_TODAY_LEVEL[c.level] ?? '基礎',
		cat: toSchedCat(c.category),
		status: 'wait' // P2: 後端無「今日即時狀態」概念
	};
}

/** 依 start 升冪排序 —— 零填充的 "HH:MM" 可直接字典序比較；無時間者(schedule_text
 *  為 null → start '')排最後，不讓未知時間的課搶走頁面「下一堂課」的位置。mock seed
 *  的 TODAY_CLASSES 本來就是時間序,頁面(dashboard 的 nextClass、today 的課表)一直
 *  依賴這個隱含順序,接縫在此恢復同一保證。 */
function byStartTime(a: TodayClass, b: TodayClass): number {
	const ka = a.start || '99:99';
	const kb = b.start || '99:99';
	return ka < kb ? -1 : ka > kb ? 1 : 0;
}

async function myTodayClasses(coachId: string): Promise<TodayClass[]> {
	const courses = await listCourses();
	return courses.filter((c) => c.coach_id === coachId).map(mapTodayClass).sort(byStartTime);
}

/** 首頁 KPI 卡數字(待點名/出席率/待回覆)原為頁面硬編字串,一併移入接縫。 */
export interface CoachDashboardData {
	coach: Coach;
	todayLabel: string;
	todayClasses: TodayClass[];
	conversations: Conversation[];
	pendingClasses: string;
	attendanceRate: string;
	pendingReplies: string;
}
export const getDashboard = async (): Promise<CoachDashboardData> => {
	const { user, coach } = await requireMyCoach();
	return {
		coach: mapCoach(user, coach),
		todayLabel: TODAY_LABEL,
		todayClasses: await myTodayClasses(coach.id),
		conversations: CONVERSATIONS, // getMessages 領域，仍為 mock
		pendingClasses: '0 班', // P2: 後端無「待點名班級數」統計端點
		attendanceRate: '0%', // P2: 後端無「學員出席率」統計端點
		pendingReplies: '0 則' // P2: 後端無「待回覆訊息數」統計端點(getMessages 仍為 mock)
	};
};

export interface TodayData { todayLabel: string; todayClasses: TodayClass[] }
export const getToday = async (): Promise<TodayData> => {
	const { coach } = await requireMyCoach();
	return { todayLabel: TODAY_LABEL, todayClasses: await myTodayClasses(coach.id) };
};

// P2: 後端無對應的點名/出勤端點，整包沿用 mock。
export interface AttendanceData { classes: AttClassFull[] }
export const getAttendance = (): Promise<AttendanceData> => reply({ classes: ATT_TODAY_CLASSES });

/* ═════════════════════════ 排課管理（GET /coaches/{id}/schedule） ═════════════════════════ */

interface ApiCoachSchedule {
	id: string;
	day_of_week: number; // 0-6, 0=Sunday
	start_time: string; // "HH:MM:SS"
	end_time: string;
	is_available: boolean;
}

/** Date.getDay() 順序（0=Sun），同 schedule-dates.ts 的 KEYS。 */
const DOW_TO_KEY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface CoachScheduleData { courses: SchedCourse[] }

/** CoachScheduleResponse 是教練「可授課時段」，不是特定課程場次 —— 沒有 name/count/
 *  cat/venue 欄位，一律誠實給預設值(P2，各自附註)；day/start/end 是真實映射（day_of_week
 *  → Mon..Sun key，HH:MM:SS 裁切為 HH:MM 供既有 UI 顯示）；只保留 is_available 的時段
 *  （未開放的時段不是真的可授課，不該顯示成一個假課程區塊）。 */
export const getSchedule = async (): Promise<CoachScheduleData> => {
	const { coach } = await requireMyCoach();
	const slots = await api<ApiCoachSchedule[]>(`/coaches/${coach.id}/schedule`, { auth: false });
	return {
		courses: slots
			.filter((s) => s.is_available)
			.map((s) => ({
				day: DOW_TO_KEY[s.day_of_week],
				start: s.start_time.slice(0, 5),
				end: s.end_time.slice(0, 5),
				name: '可授課時段', // P2: availability 端點無課程名稱欄位(非特定課程場次)
				count: 0, // P2: 同上，無學員人數欄位
				cat: '體操', // P2: 同上，無課程類別欄位
				venue: '主場館' // P2: 同上，無場館欄位
			}))
	};
};

/* ═════════════════════════ 訊息中心 / 學員（P2：無對應後端端點，整包沿用 mock） ═════════════════════════ */

// P2: 後端無對應的訊息中心端點，整包沿用 mock。
export interface MessagesData {
	conversations: Conversation[];
	directory: MsgRecipient[];
	thread: ThreadMsg[];
	sharedFiles: SharedFile[];
}
export const getMessages = (): Promise<MessagesData> =>
	reply({ conversations: CONVERSATIONS, directory: MSG_DIRECTORY, thread: THREAD, sharedFiles: SHARED_FILES });

// P2: 後端無對應的學員名冊端點，整包沿用 mock。
export interface StudentsData { students: Student[] }
export const getStudents = (): Promise<StudentsData> => reply({ students: STUDENTS });

/* ═════════════════════════ 個人設定（GET /users/me；儲存 → PATCH /users/me） ═════════════════════════ */

export interface CoachSettingsData { coach: Coach }
export const getSettings = async (): Promise<CoachSettingsData> => {
	const { user, coach } = await requireMyCoach();
	return { coach: mapCoach(user, coach) };
};

/** ProfileTab 可編輯的欄位裡，只有 name/phone 有對應的後端 PATCH 欄位（avatar_url 目前
 *  沒有 UI 入口，未使用）；email/gender/birth/emergency/bio 後端不支援寫入，維持頁面
 *  本地編輯、不送出(同既有行為)。寫入成功後重新取得最新資料，不直接拼字串回傳。 */
export const saveSettings = async (fields: { name?: string; phone?: string }): Promise<CoachSettingsData> => {
	await api('/users/me', { method: 'PATCH', body: JSON.stringify(fields) });
	const { user, coach } = await requireMyCoach();
	return { coach: mapCoach(user, coach) };
};
