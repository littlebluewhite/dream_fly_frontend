/* 教練工作台 API 接縫。Task 19：getDashboard/getToday/getSchedule/getSettings 換真後端
 * 資料 + saveSettings 新增；Task 10：getAttendance/getStudents 換真後端資料；
 * Task 12：getConversations/getThread/sendMessage/markRead 換真後端資料（訊息中心，
 * §3.21）。回傳「形狀」盡量維持不變，頁面不用重寫樣板。
 *
 * 教練身分：本人帳號資料($lib/self-account，GET /users/me) + GET /coaches →
 * find(user_id === account.id) 是本檔案的核心（登入的使用者本人就是教練，教練姓名只能從
 * users.name 來，見 integration-contract.md §3.4 附註）。R13 Task 7(C6)起由私有 session
 * 閘門快取：每個登入身分只解析一次，換帳號/登出即重置。R16 Task 1b 起這顆閘門只快取
 * ApiCoach | null，本人資料一律讀 $selfAccount(與會員端同一份快取)。找不到對應教練檔案時，getDashboard/getToday/getSchedule/
 * getSettings/getAttendance 一律拋出 CoachNotFoundError，頁面經 coachLoadErrorCopy
 * (instanceof 判別，R16 Task 8)改顯示「此帳號未綁定教練檔案」。 */
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { createSessionGate } from '$lib/session-gate';
import { authStore } from '$lib/stores/authStore';
import { selfAccount, hydrateSelfAccount, saveSelfAccount, type SelfAccount } from '$lib/self-account';
import { fmtRatio } from '$lib/format';
import { listCoaches } from '$lib/public/api';
import type { ApiCoach } from '$lib/public/api';
import { initialOf, BRAND_PRIMARY_HEX, isoDateTime, isoDate, hhmm } from '$lib/api/wire';
import type { TodaySessionResponse } from '$lib/api/wire';
import type {
	AdminLeaveRequestResponse,
	CertificateResponse,
	CoachReportResponse,
	CoachScheduleResponse,
	ConversationResponse,
	ConversationSummaryResponse,
	LeaveRequestListResponse,
	LeaveRequestResponse,
	MarkReadResponse,
	MessageListResponse,
	MessageResponse,
	MyStudentResponse,
	ReportCardResponse,
	RosterEntryResponse
} from '$lib/api/generated';
import { toTodaySession } from '$lib/domain/sessions';
import { todayLabel } from './schedule-dates';
import type {
	Coach,
	TodayClass,
	Conversation,
	AttClassFull,
	AttRow,
	AttDefault,
	SchedCourse,
	Student,
	ThreadMsg
} from './data';

/** 教練身分找不到對應教練檔案時拋出；UI 顯示「此帳號未綁定教練檔案」。 */
export class CoachNotFoundError extends Error {
	constructor() {
		super('此帳號未綁定教練檔案');
		this.name = 'CoachNotFoundError';
	}
}

/* ═════════════════════════ 教練本人（本人帳號資料 + GET /coaches） ═════════════════════════ */

/** 登入者本人對應的教練檔案(GET /coaches 只回 active 教練;找不到為 null)。本人資料
 *  由 $lib/self-account 持有(已水合就不重打 GET /users/me)。 */
let myCoach: ApiCoach | null = null;

/** 每個登入身分只解析一次;換帳號/登出(authStore identity 變更)即清空,在飛的舊回應由
 *  閘門的 epoch 核對作廢(本人帳號資料的閘門同一時刻各自重置)。 */
const gate = createSessionGate<ApiCoach | null>({
	fetch: async () => {
		const [, coaches] = await Promise.all([hydrateSelfAccount(), listCoaches()]);
		const id = get(selfAccount)?.id;
		return coaches.find((c) => c.user_id === id) ?? null;
	},
	apply: (c) => {
		myCoach = c;
	},
	reset: () => {
		myCoach = null;
	}
});

/** 教練身分(快取命中不打 API;併發呼叫共用同一支在飛解析——閘門的 hydrate 合併)。沒有
 *  教練檔案時 invalidate 再拋 CoachNotFoundError——管理員綁定教練檔案後,使用者按重試就會
 *  重新解析。 */
async function requireCoach(): Promise<{ account: SelfAccount; coach: ApiCoach }> {
	await gate.hydrate();
	const coach = myCoach;
	if (!coach) {
		gate.invalidate();
		throw new CoachNotFoundError();
	}
	// 閘門的 fetch 已等本人帳號資料水合,兩顆閘門同一 identity 變更時一起重置 → 必有值
	return { account: get(selfAccount)!, coach };
}

/** 教練身分(本人帳號資料 + coach)組合成既有 Coach 形狀，getDashboard/getSettings 共用。
 *  name/display/full/initial 由 account.name 推導（東亞姓名慣例：首字視為姓氏，同 mock 原始
 *  資料「李志偉」→「李教練」/「李志偉 教練」的推導方式一致）；role/bio/chips 來自
 *  ApiCoach 的 title/bio/certifications；id 改用教練真實 uuid（舊「DF-C2019-007」員編
 *  格式後端無對應欄位，P2）；birth 讀 account.birth(GET /users/me 的真實生日)；英文姓名/
 *  性別/緊急聯絡人後端無對應欄位，R16 Task 2a 起從 Coach 形狀拿掉(不再誠實給空字串)；
 *  registered 用 coach.created_at；lastLogin 用 account.lastLogin。 */
function mapCoach(account: SelfAccount, coach: ApiCoach): Coach {
	const surname = account.initial;
	return {
		name: account.name,
		display: `${surname}教練`,
		full: `${account.name} 教練`,
		initial: surname,
		// Task 4 判斷：CoachResponse 新增的 name 欄位在此不適用 —— name/display/full/
		// initial 已經正確取自 account.name(教練本人的真實姓名，見上方函式註解)；role 這裡
		// 語意上是「職稱」(routes/coach/settings 渲染成「{role}」的職銜列)，不是
		// 姓名欄位，繼續用 coach.title 才是對的欄位，不需要也不應該改成 coach.name。
		role: coach.title,
		id: coach.id, // P2: 舊員編格式(DF-C2019-007)無對應欄位，改用教練 uuid
		email: account.email,
		phone: account.phone,
		birth: account.birth,
		bio: coach.bio ?? '',
		chips: coach.certifications,
		registered: isoDate(coach.created_at),
		lastLogin: account.lastLogin
	};
}

/* ═════════════════════════ 今日課程 / 儀表板（GET /sessions/today，見 integration-contract.md §3.18） ═════════════════════════ */

/** TodaySessionResponse(§3.18，教練/admin 兩分支共用同一形狀，後端產生型別，W-5)。
 *  教練呼叫時後端已只回自己課程（courses.coach_id 對應呼叫者 coaches.id）的今日場次，
 *  並依 start_time 排序——前端不再需要自行過濾/排序。 */

/** TodaySessionResponse → 既有 TodayClass 形狀，經 domain/sessions 的 toTodaySession 投影
 *  （C5：admin/coach/mobile-admin 共用同一支純函式，不再自行重算 hhmm/venue 預設值/狀態，
 *  見 docs/adr/0023）。課程等級/分類無對應欄位，R16 Task 2a 起從 TodayClass 拿掉。 */
function mapTodayClass(s: TodaySessionResponse): TodayClass {
	const t = toTodaySession(s);
	return {
		id: t.id,
		start: t.start,
		end: t.end,
		name: t.name,
		room: t.room,
		count: t.count,
		status: t.state
	};
}

async function myTodayClasses(): Promise<TodayClass[]> {
	const sessions = await api<TodaySessionResponse[]>('/sessions/today');
	return sessions.map(mapTodayClass);
}

/* ═════════════════════════ 報表彙總（GET /reports/coach，見 integration-contract.md §3.24） ═════════════════════════ */

/** 首頁 KPI 卡數字(待點名/出席率/待回覆)原為頁面硬編字串,一併移入接縫。 */
export interface CoachDashboardData {
	coach: Coach;
	todayLabel: string;
	todayClasses: TodayClass[];
	/** best-effort：由 getDashboard() 併入真 getConversations()；訊息中心暫時失敗時
	 *  降級為空陣列(頁面顯示「尚無訊息」)，不連累 KPI/今日課程等主資料。 */
	conversations: Conversation[];
	pendingClasses: string;
	attendanceRate: string;
	pendingReplies: string;
}

/** todayClasses(GET /sessions/today)與 reports(GET /reports/coach)彼此獨立、平行拉取。
 *  待點名/學員出席率/待回覆訊息 3 個原 P2 佔位欄位改讀 pending_attendance/
 *  attendance_rate_30d/unread_messages(§3.24)；today_sessions/student_count 這支端點
 *  也有回，但目前頁面沒有對應顯示欄位(today 課程數已由 todayClasses.length 呈現)，
 *  不強塞新卡片。conversations 由 getConversations() best-effort 併入(降級語意見
 *  下方行內註解)。 */
export const getDashboard = async (): Promise<CoachDashboardData> => {
	const { account, coach } = await requireCoach();
	const [todayClasses, reports, conversations] = await Promise.all([
		myTodayClasses(),
		api<CoachReportResponse>('/reports/coach'),
		// conversations 為 best-effort：訊息中心暫時失敗只降級為空陣列，不讓非核心的
		// 最新訊息面板擋住整頁 KPI/今日課程(同 $lib/store-warm 的 warmStores
		// best-effort 語意——主資料 fail-hard、順手資料失敗只記錄)。
		getConversations()
			.then((c) => c.conversations)
			.catch((e): Conversation[] => {
				console.error('getDashboard: 訊息中心載入失敗', e);
				return [];
			})
	]);
	return {
		coach: mapCoach(account, coach),
		todayLabel: todayLabel(),
		todayClasses,
		conversations,
		pendingClasses: `${reports.pending_attendance} 班`,
		// attendance_rate_30d 為 null(無出勤資料，裁決 3)時顯示「尚無資料」，不是 0%
		// (0% 會誤導成「有資料、出席率為零」)。
		attendanceRate: fmtRatio(reports.attendance_rate_30d, '尚無資料'),
		pendingReplies: `${reports.unread_messages} 則`
	};
};

export interface TodayData { todayLabel: string; todayClasses: TodayClass[] }
export const getToday = async (): Promise<TodayData> => {
	await requireCoach(); // 仍需先確認教練檔案存在(CoachNotFoundError 閘門)，即使 todayClasses 不再需要 coach.id
	return { todayLabel: todayLabel(), todayClasses: await myTodayClasses() };
};

/* ═════════════════════════ 點名（GET /sessions/{id}/roster + PUT .../attendance，見 integration-contract.md §3.19） ═════════════════════════ */

/** RosterEntryResponse → 既有 AttRow 形狀。mid 原為「GY2024001」格式的會員編號(無對應
 *  欄位)，改用 enrolment_id(同時也是 saveAttendance 送出時要回傳的鍵值)；n 為依姓名
 *  排序後(後端回應本就依姓名排序)的顯示序號，純前端呈現;color 無代表色欄位,固定預設值
 *  (P2，同 mapScheduleEntry 慣例)。attendance_status 為 null(尚未點名)時，本地草稿預設
 *  'present'(同既有「全部標記出席」/dirtyCount 以出席為基準狀態的慣例，未儲存前不代表
 *  已送出任何資料)。 */
function mapRosterRow(r: RosterEntryResponse, i: number): AttRow {
	return {
		n: String(i + 1).padStart(2, '0'),
		name: r.user_name,
		initial: initialOf(r.user_name),
		color: BRAND_PRIMARY_HEX, // P2: 後端無代表色欄位
		mid: r.enrolment_id,
		def: r.attendance_status ?? 'present'
	};
}

/** TodaySessionResponse + 該場次名冊 → 既有 AttClassFull 形狀，經 toTodaySession 投影（同
 *  mapTodayClass 慣例，C5）。time 組成「今日 HH:MM–HH:MM」(場次本來就是今日的，同既有
 *  mock 格式慣例)；start 另帶起始 HH:MM 供 sessionChipLabel 直接使用；room 經投影(null →
 *  '—')；coach 為呼叫者自己(這是教練本人的場次，見 getAttendance)，不是 t.coach。 */
function mapAttendanceClass(
	s: TodaySessionResponse,
	roster: RosterEntryResponse[],
	coachName: string
): AttClassFull {
	const t = toTodaySession(s);
	return {
		id: t.id,
		name: t.name,
		time: `今日 ${t.start}–${t.end}`,
		start: t.start,
		room: t.room,
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
 *  state 可重試，而非誤導性的「今日尚無場次」空狀態)。requireCoach() 閘門同
 *  getToday()(即使本函式主要需要的是 user.name 顯示用，不是 coach.id)——教練檔案
 *  不存在時兩者一致丟 CoachNotFoundError。 */
export const getAttendance = async (): Promise<AttendanceData> => {
	const { account } = await requireCoach();
	const sessions = await api<TodaySessionResponse[]>('/sessions/today');
	const results = await Promise.allSettled(
		sessions.map((s) => api<RosterEntryResponse[]>(`/sessions/${s.id}/roster`))
	);
	const classes: AttClassFull[] = [];
	const failedClasses: string[] = [];
	sessions.forEach((s, i) => {
		const r = results[i];
		if (r.status === 'fulfilled') {
			classes.push(mapAttendanceClass(s, r.value, account.name));
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
 *  { records: [{ enrolment_id, status }] } 送出(AttDefault 與後端 status 同為
 *  present/absent/leave 三值，原樣送出)。回應為更新後的完整名冊，重新映射回傳讓頁面
 *  拿來同步 marks(以伺服器為準，而非樂觀本地值)。 */
export const saveAttendance = async (
	sessionId: string,
	marks: Record<string, AttDefault>
): Promise<AttRow[]> => {
	const records = Object.entries(marks).map(([enrolment_id, mark]) => ({
		enrolment_id,
		status: mark
	}));
	const roster = await api<RosterEntryResponse[]>(`/sessions/${sessionId}/attendance`, {
		method: 'PUT',
		body: JSON.stringify({ records })
	});
	return roster.map(mapRosterRow);
};

/* ═════════════════════════ 排課管理（GET /coaches/{id}/schedule） ═════════════════════════ */

/** day_of_week 0=Sun..6=Sat，即 Date.getDay() 順序，同 schedule-dates.ts 的 KEYS。 */
const DOW_TO_KEY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export interface CoachScheduleData { courses: SchedCourse[] }

/** CoachScheduleResponse 是教練「可授課時段」，不是特定課程場次 —— 沒有課名/人數/
 *  分類/場館欄位，R16 Task 2a 起 SchedCourse 只留 day/start/end 真實映射（day_of_week
 *  → Mon..Sun key，HH:MM:SS 裁切為 HH:MM 供既有 UI 顯示），「可授課時段」標籤是元件
 *  裡的字面值；只保留 is_available 的時段
 *  （未開放的時段不是真的可授課，不該顯示成一個假課程區塊）。 */
export const getSchedule = async (): Promise<CoachScheduleData> => {
	const { coach } = await requireCoach();
	const slots = await api<CoachScheduleResponse[]>(`/coaches/${coach.id}/schedule`, { auth: false });
	return {
		courses: slots
			.filter((s) => s.is_available)
			.map((s) => ({
				day: DOW_TO_KEY[s.day_of_week],
				start: hhmm(s.start_time),
				end: hhmm(s.end_time)
			}))
	};
};

/* ═════════════════════════ 訊息中心（GET /conversations/me + GET/POST .../messages + PATCH .../read，見 integration-contract.md §3.21） ═════════════════════════ */

/** ISO8601 → "YYYY-MM-DD HH:MM"，同 mapCoach 的 lastLogin 轉換慣例。 */
const toDisplayTime = (iso: string): string => isoDateTime(iso);

/** ConversationSummaryResponse → 既有 Conversation 形狀。對話兩端固定一為 coach、一為
 *  member（§3.21 角色規則），且 CONTEXT.md 明定「會員」帳號即學員本人、不分家長/學員
 *  （Avoid: 家長），故不帶對話種類欄位(R16 Task 2a 起拿掉 kind)；color 無代表色欄位，同其餘 mapXxx 慣例
 *  固定預設值(P2)。time 由 last_message_at 轉換
 *  （尚無訊息的 null 給空字串）；preview 由 last_message_body 轉換，null 時比照既有
 *  「撰寫新對話」的建立文案 '尚無訊息'；badge 直接用 unread_count(brief 明定)。清單
 *  順序完全依後端排序(last_message_at DESC NULLS LAST, created_at DESC)，前端不重排。 */
function mapConversation(r: ConversationSummaryResponse): Conversation {
	return {
		id: r.id,
		name: r.peer_name,
		initial: initialOf(r.peer_name),
		color: BRAND_PRIMARY_HEX, // P2: 後端無代表色欄位
		time: r.last_message_at ? toDisplayTime(r.last_message_at) : '',
		badge: r.unread_count,
		preview: r.last_message_body ?? '尚無訊息'
	};
}

export interface ConversationsData {
	conversations: Conversation[];
}

/** GET /conversations/me（純陣列，不分頁，見§3.21）。 */
export const getConversations = async (): Promise<ConversationsData> => {
	const list = await api<ConversationSummaryResponse[]>('/conversations/me');
	return { conversations: list.map(mapConversation) };
};

/** MessageResponse → 既有 ThreadMsg 形狀。who 由 sender_id 與呼叫者自己的 user id 比對
 *  得出；attach/failed 兩個 mock 概念皆不設(v1 不支援檔案附件，見§3.21「v1 不支援檔案
 *  附件」——MessageBubble 對兩者皆未提供時自然落到純文字泡泡分支)。 */
function mapMessage(m: MessageResponse, selfId: string): ThreadMsg {
	return { who: m.sender_id === selfId ? 'me' : 'them', text: m.body, time: toDisplayTime(m.created_at) };
}

export interface ThreadData {
	messages: ThreadMsg[];
	/** 伺服器端該對話訊息總數——單頁上限 100(同 getPendingLeaveRequests 的 per_page=100
	 *  穿透模式)。total > messages.length 代表更早的訊息(超過 100 則的部分)被截斷。 */
	total: number;
}

/** GET /conversations/{id}/messages?per_page=100（見§3.21）。per_page 顯式帶滿單頁上限
 *  （同 getPendingLeaveRequests 慣例，避免後端預設頁大小截斷長對話串）；total 穿透供
 *  呼叫端誠實呈現截斷狀況。後端依 created_at DESC(新到舊)排序，但對話串泡泡由上到下
 *  應是舊到新時序(同既有 THREAD mock 資料的時序)，故映射後反轉。判斷 who='me'|'them'
 *  用登入者自己的 user id——直接讀 authStore，不另打 GET /users/me(C6)。 */
export const getThread = async (conversationId: string): Promise<ThreadData> => {
	const selfId = get(authStore).member?.id ?? '';
	const res = await api<MessageListResponse>(`/conversations/${conversationId}/messages?per_page=100`);
	return { messages: res.messages.map((m) => mapMessage(m, selfId)).reverse(), total: res.total };
};

/** POST /conversations/{id}/messages（body 1–2000 字，見§3.21）。回應的 sender_id 契約
 *  保證為呼叫者自己，直接標記 who='me'，不需要再另外取得/比對 self id。 */
export const sendMessage = (conversationId: string, body: string): Promise<ThreadMsg> =>
	api<MessageResponse>(`/conversations/${conversationId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ body })
	}).then((m) => ({ who: 'me' as const, text: m.body, time: toDisplayTime(m.created_at) }));

/** PATCH /conversations/{id}/read（無 body，見§3.21）——將該對話中對方寄出、尚未讀取
 *  的訊息全數標記已讀；回應為本次標記已讀的則數。 */
export const markRead = (conversationId: string): Promise<MarkReadResponse> =>
	api<MarkReadResponse>(`/conversations/${conversationId}/read`, { method: 'PATCH' });

/** POST /conversations（get-or-create，見§3.21）——撰寫新對話：user_id 帶對方(學員)的
 *  user id。同一對使用者無論呼叫幾次都回同一筆對話（無序對唯一），重複選同一位學員
 *  是安全的。回應不含 peer_name/unread_count/last_message_body（ConversationResponse
 *  非 Summary），故 peerName 由呼叫端(picker 已知選了誰)帶入，其餘欄位以「尚無訊息、
 *  未讀 0」映射——get-or-create 命中既有對話時這些值可能失真，但頁面對已在清單中的
 *  id 走合併(保留既有列)不會用到本映射值，僅全新對話會插入。錯誤(422「僅支援教練與
 *  會員間的對話」等)原樣拋出，呼叫端以 ApiError.message 顯示繁中訊息。 */
export const createConversation = async (userId: string, peerName: string): Promise<Conversation> => {
	const c = await api<ConversationResponse>('/conversations', {
		method: 'POST',
		body: JSON.stringify({ user_id: userId })
	});
	return mapConversation({
		id: c.id,
		peer_id: userId,
		peer_name: peerName,
		last_message_body: null,
		last_message_at: c.last_message_at,
		unread_count: 0
	});
};

/* ═════════════════════════ 我的學員（GET /coaches/me/students，見 integration-contract.md §3.19） ═════════════════════════ */

/** MyStudentResponse → 既有 Student 形狀。user_id 穿透(訊息中心「撰寫新對話」的
 *  POST /conversations 需要對方 user id，picker 直接用 getStudents() 名冊)；courses
 *  結構化穿透(寫評語 dialog 需要 enrolment_id，多堂課時供教練選擇，Task 13)；cls 由
 *  courses(該學員在這位教練名下的所有課程)以「、」串接組成——忠實反映可能不只一堂
 *  課，而非只取第一堂丟掉其餘資訊；initial 由姓名首字推導(同 mapProfile 慣例)；
 *  color 無代表色欄位,固定預設值(P2)。程度/技能評量/出勤率無對應欄位(此端點不含
 *  技能評量/出勤統計——§3.19 的 attended/total 是 member 視角的單一課程統計，見
 *  GET /enrolments/me，非教練視角的單一學員數字)，R16 Task 2a 起從 Student 拿掉。 */
function mapStudent(s: MyStudentResponse): Student {
	return {
		user_id: s.user_id,
		name: s.name,
		initial: initialOf(s.name),
		color: BRAND_PRIMARY_HEX, // P2: 後端無代表色欄位
		cls: s.courses.map((c) => c.course_name).join('、'),
		courses: s.courses
	};
}

export interface StudentsData { students: Student[] }

/** 無需 requireCoach() 閘門——呼叫者掛 coach 角色但查無對應 coaches 資料列時，後端
 *  本身就回空陣列而非錯誤(同 GET /sessions/today 的慣例，見 §3.19)，不需要前端另外
 *  判斷教練檔案是否存在。 */
export const getStudents = async (): Promise<StudentsData> => {
	const students = await api<MyStudentResponse[]>('/coaches/me/students');
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

/** AdminLeaveRequestResponse(教練/admin 清單版，會員形狀另加申請人) → 待審核清單只需要的
 *  窄化形狀——course_id/user_id/session_id/status/makeup_* 對這個頁面(只列 pending、決定後就從清單消失)
 *  沒有顯示用途，同 api.ts 窄化 local interface 的慣例。 */
function mapCoachLeaveRequest(r: AdminLeaveRequestResponse): CoachLeaveRequest {
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
 *  無需 requireCoach() 閘門——同 getStudents() 慣例，呼叫者掛 coach 角色但查無對應
 *  coaches 資料列時後端本身回空頁而非錯誤（§3.20 引用 §3.18/§3.19 既有慣例）。教練
 *  只會看到自己課程的待審核假單，後端已按 courses.coach_id 過濾，前端不需要另外篩選。 */
export const getPendingLeaveRequests = async (): Promise<PendingLeaveRequestsData> => {
	const res = await api<LeaveRequestListResponse>('/leave-requests?status=pending&per_page=100');
	return { requests: res.leave_requests.map(mapCoachLeaveRequest), total: res.total };
};

/** PATCH /leave-requests/{id}（帶 { status: 'approved' | 'rejected' }）。核准會在同一
 *  交易內把該場次寫入 attendance leave 紀錄；駁回僅更新假單狀態(見 §3.20)——兩者對
 *  前端來說是同一個動作,差別只在送出的 status 值。404/403/409/422 原樣拋出，呼叫端
 *  (leave-requests/+page.svelte)依 ApiError 顯示對應繁中錯誤(這個模組後端本身就已
 *  回繁中訊息，同 member/stores.ts 的 leaveRequestErrorMessage 慣例)。回應是會員形狀
 *  LeaveRequestResponse(無 user_name)——呼叫端不讀回應，決定後假單直接自清單移除。 */
export const decideLeaveRequest = async (id: string, status: 'approved' | 'rejected'): Promise<void> => {
	await api<LeaveRequestResponse>(`/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
};

/* ═════════════════════════ 個人設定（本人帳號資料；儲存 → saveSelfAccount → PATCH /users/me） ═════════════════════════ */

export interface CoachSettingsData { coach: Coach }
export const getSettings = async (): Promise<CoachSettingsData> => {
	const { account, coach } = await requireCoach();
	return { coach: mapCoach(account, coach) };
};

/** ProfileTab 可編輯的欄位裡，只有 name/phone 有對應的後端 PATCH 欄位（avatar_url 目前
 *  沒有 UI 入口，未使用）；email/birth/bio 後端不支援經此寫入，頁面唯讀顯示或不提供
 *  輸入(R16 Task 2a)。R16 Task 1b:先解析教練(快取命中不打 API),再交給
 *  saveSelfAccount——它與目前值比對、只送改過的欄位(電話 null 的教練只改姓名時不再送
 *  phone: '' 撞後端 8–20 碼驗證的 422),表單規則不合法就不發請求;PATCH 回應寫回
 *  $selfAccount 並 authStore.syncUser(Topbar 等處的姓名跟著變),不重抓。簽章不變:失敗
 *  (含驗證錯誤、換帳號後被跳過)照樣 throw。 */
export const saveSettings = async (edit: { name?: string; phone?: string }): Promise<CoachSettingsData> => {
	const { coach } = await requireCoach();
	const outcome = await saveSelfAccount(edit);
	if (outcome.kind === 'failed') throw outcome.error;
	return { coach: mapCoach(get(selfAccount)!, coach) };
};

/* ═════════════════════════ 發證書（POST /certificates，見 integration-contract.md §3.22） ═════════════════════════ */

export interface CreateCertificateBody {
	user_id: string;
	course_id?: string;
	title: string;
	level?: string;
	issued_on: string; // "YYYY-MM-DD"
	note?: string;
}

/** POST /certificates — coach 限「曾是或現是自己課程學員」的使用者（§3.22，與 body
 *  是否帶 course_id 無關）；v1 純 metadata，無 PDF/檔案上傳。回應直接透傳——students
 *  頁的發證書 dialog 只需要知道成功與否，不需要顯示欄位（同 admin/api.ts 的
 *  createCoupon 慣例：呼叫端自行處理 toast/錯誤訊息，本函式不做映射）。 */
export const createCertificate = (body: CreateCertificateBody): Promise<CertificateResponse> =>
	api<CertificateResponse>('/certificates', { method: 'POST', body: JSON.stringify(body) });

/* ═════════════════════════ 寫評語（POST /report-cards，見 integration-contract.md §3.22） ═════════════════════════ */

export interface CreateReportCardBody {
	enrolment_id: string;
	term_label: string;
	comment?: string;
	rating?: number; // 1–5
}

/** POST /report-cards — coach 限自己課程的 enrolment（§3.22）。同一 enrolment 同一
 *  期別僅能建立一次（UNIQUE(enrolment_id, term_label)），重複回 409「此期別已建立過
 *  成績單」；rating 選填 1–5（0/6 回 422）。回應直接透傳（同 createCertificate 慣例：
 *  呼叫端自行處理 toast/錯誤訊息，本函式不做映射）。 */
export const createReportCard = (body: CreateReportCardBody): Promise<ReportCardResponse> =>
	api<ReportCardResponse>('/report-cards', { method: 'POST', body: JSON.stringify(body) });
