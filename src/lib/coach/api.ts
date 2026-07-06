/* 教練工作台 API 接縫。Task 19：getDashboard/getToday/getSchedule/getSettings 換真後端
 * 資料 + saveSettings 新增；Task 10：getAttendance/getStudents 換真後端資料；
 * getMessages 沒有對應後端端點，仍整包沿用 mock（P2，附註於原處）。回傳「形狀」盡量
 * 維持不變，頁面不用重寫樣板。
 *
 * myCoachProfile()：GET /users/me → GET /coaches → find(user_id === me.id) 是本檔案
 * 的核心（登入的使用者本人就是教練，教練姓名只能從 users.name 來，見 integration-
 * contract.md §3.4 附註）。找不到對應教練檔案時，getDashboard/getToday/getSchedule/
 * getSettings/getAttendance 一律拋出 CoachNotFoundError，頁面 catch 用 e.name 判斷
 * （不是 instanceof —— 頁面測試把 $lib/coach/api 整支模組換成只有單一 getter 的假模組，
 * import 進來的 class 會是 undefined，instanceof undefined 會炸掉），改顯示「此帳號
 * 未綁定教練檔案」。 */
import { api } from '$lib/api/client';
import { listCoaches } from '$lib/public/api';
import type { ApiCoach } from '$lib/public/api';
import { TODAY_LABEL, CONVERSATIONS, MSG_DIRECTORY, THREAD, SHARED_FILES } from './data';
import type {
	Coach,
	TodayClass,
	TodayStatus,
	Conversation,
	AttClassFull,
	AttRow,
	AttDefault,
	SchedCourse,
	Student,
	MsgRecipient,
	ThreadMsg,
	SharedFile
} from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。getMessages 仍沿用此 helper。 */
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

/* ═════════════════════════ 今日課程 / 儀表板（GET /sessions/today，見 integration-contract.md §3.18） ═════════════════════════ */

/** TodaySessionResponse（§3.18）。教練呼叫時後端已只回自己課程（courses.coach_id 對應
 *  呼叫者 coaches.id）的今日場次，並依 start_time 排序——前端不再需要自行過濾/排序。 */
interface ApiTodaySession {
	id: string;
	course_id: string;
	course_name: string;
	start_time: string; // "HH:MM:SS"
	end_time: string;
	enrolled_count: number;
}

/** now 轉為本地牆鐘 "HH:MM:SS"，供與 start_time/end_time 直接字典序比較(§3.18 裁決 2：
 *  場次時間為牆鐘語意，前端以本地時間直接比較，不做時區換算)。 */
function wallClockTime(now: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/** 場次狀態推導：now < start_time → 'wait'；start_time ≤ now < end_time → 'live'；
 *  now ≥ end_time → 'done'。now 由呼叫端傳入的純函式，不吃系統時鐘，獨立可測。 */
export function deriveSessionStatus(startTime: string, endTime: string, now: Date): TodayStatus {
	const wall = wallClockTime(now);
	if (wall < startTime) return 'wait';
	if (wall < endTime) return 'live';
	return 'done';
}

/** TodaySessionResponse → 既有 TodayClass 形狀。room/level/cat 無對應欄位(場次回應不含
 *  場地/課程等級/課程分類)，一律誠實給預設值(P2)；count 用 enrolled_count；status 由
 *  deriveSessionStatus 依目前時間推導(§3.18 裁決 2)。 */
function mapTodayClass(s: ApiTodaySession, now: Date): TodayClass {
	return {
		id: s.id,
		start: s.start_time.slice(0, 5),
		end: s.end_time.slice(0, 5),
		name: s.course_name,
		room: '', // P2: TodaySessionResponse 無場地欄位
		count: s.enrolled_count,
		level: '基礎', // P2: TodaySessionResponse 無課程等級欄位
		cat: '體操', // P2: TodaySessionResponse 無課程分類欄位
		status: deriveSessionStatus(s.start_time, s.end_time, now)
	};
}

async function myTodayClasses(): Promise<TodayClass[]> {
	const sessions = await api<ApiTodaySession[]>('/sessions/today');
	const now = new Date();
	return sessions.map((s) => mapTodayClass(s, now));
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
		todayClasses: await myTodayClasses(),
		conversations: CONVERSATIONS, // getMessages 領域，仍為 mock
		pendingClasses: '0 班', // P2: 後端無「待點名班級數」統計端點
		attendanceRate: '0%', // P2: 後端無「學員出席率」統計端點
		pendingReplies: '0 則' // P2: 後端無「待回覆訊息數」統計端點(getMessages 仍為 mock)
	};
};

export interface TodayData { todayLabel: string; todayClasses: TodayClass[] }
export const getToday = async (): Promise<TodayData> => {
	await requireMyCoach(); // 仍需先確認教練檔案存在(CoachNotFoundError 閘門)，即使 todayClasses 不再需要 coach.id
	return { todayLabel: TODAY_LABEL, todayClasses: await myTodayClasses() };
};

/* ═════════════════════════ 點名（GET /sessions/{id}/roster + PUT .../attendance，見 integration-contract.md §3.19） ═════════════════════════ */

interface ApiRosterEntry {
	enrolment_id: string;
	user_id: string;
	user_name: string;
	attendance_status: 'present' | 'absent' | 'leave' | null;
}

/** RosterEntryResponse → 既有 AttRow 形狀。mid 原為「GY2024001」格式的會員編號(無對應
 *  欄位)，改用 enrolment_id(同時也是 saveAttendance 送出時要回傳的鍵值)；n 為依姓名
 *  排序後(後端回應本就依姓名排序)的顯示序號，純前端呈現;color 無代表色欄位,固定預設值
 *  (P2，同 mapScheduleEntry 慣例)。attendance_status 為 null(尚未點名)時，本地草稿預設
 *  'present'(同既有「全部標記出席」/dirtyCount 以出席為基準狀態的慣例，未儲存前不代表
 *  已送出任何資料)；'late'(遲到)沒有對應後端狀態(§3.19：status 僅 present/absent/leave
 *  三選一)——維持既有 UI 分段可選，儲存時併入 'present'(見 saveAttendance)。 */
function mapRosterRow(r: ApiRosterEntry, i: number): AttRow {
	return {
		n: String(i + 1).padStart(2, '0'),
		name: r.user_name,
		initial: r.user_name.charAt(0) || '?',
		color: '#0066CC', // P2: 後端無代表色欄位
		mid: r.enrolment_id,
		def: r.attendance_status ?? 'present'
	};
}

/** TodaySessionResponse + 該場次名冊 → 既有 AttClassFull 形狀。time 組成「今日 HH:MM–
 *  HH:MM」(場次本來就是今日的，同既有 mock 格式慣例)；room 無對應欄位(P2，同
 *  mapTodayClass 慣例)；coach 為呼叫者自己(這是教練本人的場次，見 getAttendance)。 */
function mapAttendanceClass(s: ApiTodaySession, roster: ApiRosterEntry[], coachName: string): AttClassFull {
	return {
		id: s.id,
		name: s.course_name,
		time: `今日 ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`,
		room: '', // P2: TodaySessionResponse 無場地欄位
		coach: coachName,
		roster: roster.map(mapRosterRow)
	};
}

export interface AttendanceData {
	classes: AttClassFull[];
	/** 名冊載入失敗而被排除的場次課名(部分失敗隔離)；頁面以 toast 提示。 */
	failedClasses: string[];
}

/** 今日場次(GET /sessions/today)× 各場次名冊(GET /sessions/{id}/roster)組成點名頁的
 *  「切換班級」清單——沿用既有 UI 的全預載切換模式(選班級是本地即時切換，不是逐一
 *  非同步載入)，所以這裡一次把今日所有場次的名冊平行拉回來。名冊拉取採 allSettled
 *  部分失敗隔離：單一場次名冊暫時失敗(或觸發 rate limit)時，其餘場次照常可點名——
 *  失敗場次排除於 classes 之外、課名列入 failedClasses 供頁面提示(失敗細節只記錄，
 *  同 member getDashboard 對 best-effort hydrate 失敗的處理精神)；但今日有場次而
 *  「全部」名冊都失敗時，沒有任何可點名的班級，視為整體失敗直接拋出(頁面走 error
 *  state 可重試，而非誤導性的「今日尚無場次」空狀態)。requireMyCoach() 閘門同
 *  getToday()(即使本函式主要需要的是 user.name 顯示用，不是 coach.id)——教練檔案
 *  不存在時兩者一致丟 CoachNotFoundError。 */
export const getAttendance = async (): Promise<AttendanceData> => {
	const { user } = await requireMyCoach();
	const sessions = await api<ApiTodaySession[]>('/sessions/today');
	const results = await Promise.allSettled(
		sessions.map((s) => api<ApiRosterEntry[]>(`/sessions/${s.id}/roster`))
	);
	const classes: AttClassFull[] = [];
	const failedClasses: string[] = [];
	sessions.forEach((s, i) => {
		const r = results[i];
		if (r.status === 'fulfilled') {
			classes.push(mapAttendanceClass(s, r.value, user.name));
		} else {
			failedClasses.push(s.course_name);
			console.error(`getAttendance: ${s.course_name} 名冊載入失敗`, r.reason);
		}
	});
	const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
	if (sessions.length > 0 && classes.length === 0 && firstFailure) throw firstFailure.reason;
	return { classes, failedClasses };
};

/** PUT /sessions/{id}/attendance —— 頁面本地 marks(mid→狀態草稿)轉成 API 的
 *  { records: [{ enrolment_id, status }] } 送出；'late'(遲到)沒有對應後端狀態，併入
 *  'present'(有到場、非缺席也非請假，三態語意上最接近的對應，見 mapRosterRow 附註)。
 *  回應為更新後的完整名冊，重新映射回傳讓頁面拿來同步 marks(以伺服器為準，而非樂觀
 *  本地值)——避免一位學員被標記「遲到」存檔後，畫面仍顯示遲到、但後端其實已存成
 *  「出席」的視覺落差。 */
export const saveAttendance = async (
	sessionId: string,
	marks: Record<string, AttDefault>
): Promise<AttRow[]> => {
	const records = Object.entries(marks).map(([enrolment_id, mark]) => ({
		enrolment_id,
		status: mark === 'late' ? 'present' : mark
	}));
	const roster = await api<ApiRosterEntry[]>(`/sessions/${sessionId}/attendance`, {
		method: 'PUT',
		body: JSON.stringify({ records })
	});
	return roster.map(mapRosterRow);
};

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

/* ═════════════════════════ 訊息中心（P2：無對應後端端點，整包沿用 mock） ═════════════════════════ */

// P2: 後端無對應的訊息中心端點，整包沿用 mock。
export interface MessagesData {
	conversations: Conversation[];
	directory: MsgRecipient[];
	thread: ThreadMsg[];
	sharedFiles: SharedFile[];
}
export const getMessages = (): Promise<MessagesData> =>
	reply({ conversations: CONVERSATIONS, directory: MSG_DIRECTORY, thread: THREAD, sharedFiles: SHARED_FILES });

/* ═════════════════════════ 我的學員（GET /coaches/me/students，見 integration-contract.md §3.19） ═════════════════════════ */

interface ApiMyStudentCourse {
	course_id: string;
	course_name: string;
}
interface ApiMyStudent {
	user_id: string;
	name: string;
	phone: string | null;
	courses: ApiMyStudentCourse[];
}

/** MyStudentResponse → 既有 Student 形狀。cls 由 courses(該學員在這位教練名下的所有
 *  課程)以「、」串接組成——忠實反映可能不只一堂課，而非只取第一堂丟掉其餘資訊；
 *  initial 由姓名首字推導(同 mapProfile 慣例)；color 無代表色欄位,固定預設值(P2，同
 *  mapScheduleEntry 慣例)。level/skill/pct/att 無對應欄位(此端點不含技能評量/出勤
 *  統計——§3.19 的 attended/total 是 member 視角的單一課程統計，見 GET /enrolments/me，
 *  非教練視角的單一學員數字)，一律誠實給預設值(P2，各自附註)。 */
function mapStudent(s: ApiMyStudent): Student {
	return {
		name: s.name,
		initial: s.name.charAt(0) || '?',
		color: '#0066CC', // P2: 後端無代表色欄位
		cls: s.courses.map((c) => c.course_name).join('、'),
		level: '初階', // P2: MyStudentResponse 無學員程度欄位
		skill: '', // P2: 無技能評量欄位
		pct: 0, // P2: 無技能評量百分比欄位
		att: 0 // P2: 無出勤率統計欄位
	};
}

export interface StudentsData { students: Student[] }

/** 無需 requireMyCoach() 閘門——呼叫者掛 coach 角色但查無對應 coaches 資料列時，後端
 *  本身就回空陣列而非錯誤(同 GET /sessions/today 的慣例，見 §3.19)，不需要前端另外
 *  判斷教練檔案是否存在。 */
export const getStudents = async (): Promise<StudentsData> => {
	const students = await api<ApiMyStudent[]>('/coaches/me/students');
	return { students: students.map(mapStudent) };
};

/* ═════════════════════════ 請假審核（GET /leave-requests?status=pending + PATCH /leave-requests/{id}，見 integration-contract.md §3.20） ═════════════════════════ */

export interface CoachLeaveRequest {
	id: string;
	course_name: string;
	user_name: string;
	session_date: string; // "YYYY-MM-DD"
	start_time: string; // "HH:MM:SS"
	reason: string | null;
	created_at: string;
}

interface ApiCoachLeaveRequest {
	id: string;
	course_id: string;
	course_name: string;
	user_id: string;
	user_name: string;
	session_id: string;
	session_date: string;
	start_time: string;
	reason: string | null;
	status: string;
	makeup_session_id: string | null;
	makeup_session_date: string | null;
	makeup_start_time: string | null;
	decided_at: string | null;
	created_at: string;
}

interface ApiLeaveRequestListResponse {
	leave_requests: ApiCoachLeaveRequest[];
	total: number;
	page: number;
	per_page: number;
}

/** LeaveRequestResponse(教練/admin 清單版) → 待審核清單只需要的窄化形狀——course_id/
 *  user_id/session_id/status/makeup_* 對這個頁面(只列 pending、決定後就從清單消失)
 *  沒有顯示用途，同 api.ts 窄化 local interface 的慣例。 */
function mapCoachLeaveRequest(r: ApiCoachLeaveRequest): CoachLeaveRequest {
	return {
		id: r.id,
		course_name: r.course_name,
		user_name: r.user_name,
		session_date: r.session_date,
		start_time: r.start_time,
		reason: r.reason,
		created_at: r.created_at
	};
}

export interface PendingLeaveRequestsData {
	requests: CoachLeaveRequest[];
	/** 伺服器端 pending 總數——單頁上限 100，可能大於 requests.length。頁面計數一律
	 *  用 total（以截斷後陣列長度計數會低報），total > requests.length 時另行提示。 */
	total: number;
}

/** GET /leave-requests?status=pending&per_page=100。per_page 顯式帶滿單頁上限
 *  （同 public/api.ts listCourses 的 per_page=100 慣例——後端預設 20 會截斷長清單）；
 *  total 穿透供頁面誠實計數，>100 筆時清單仍截斷，由頁面以 total 對比載入筆數提示。
 *  無需 requireMyCoach() 閘門——同 getStudents() 慣例，呼叫者掛 coach 角色但查無對應
 *  coaches 資料列時後端本身回空頁而非錯誤（§3.20 引用 §3.18/§3.19 既有慣例）。教練
 *  只會看到自己課程的待審核假單，後端已按 courses.coach_id 過濾，前端不需要另外篩選。 */
export const getPendingLeaveRequests = async (): Promise<PendingLeaveRequestsData> => {
	const res = await api<ApiLeaveRequestListResponse>('/leave-requests?status=pending&per_page=100');
	return { requests: res.leave_requests.map(mapCoachLeaveRequest), total: res.total };
};

/** PATCH /leave-requests/{id}（帶 { status: 'approved' | 'rejected' }）。核准會在同一
 *  交易內把該場次寫入 attendance leave 紀錄；駁回僅更新假單狀態(見 §3.20)——兩者對
 *  前端來說是同一個動作,差別只在送出的 status 值。404/403/409/422 原樣拋出，呼叫端
 *  (leave-requests/+page.svelte)依 ApiError 顯示對應繁中錯誤(這個模組後端本身就已
 *  回繁中訊息，同 member/stores.ts 的 leaveRequestErrorMessage 慣例)。 */
export const decideLeaveRequest = (id: string, status: 'approved' | 'rejected'): Promise<CoachLeaveRequest> =>
	api<ApiCoachLeaveRequest>(`/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }).then(
		mapCoachLeaveRequest
	);

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
