/* Dream Fly — 行動管理端 API 接縫。Task 20：從整包 reply() mock 改為 desktop
 * admin/coach seams 的薄層——直接 import `$lib/admin/api.ts`/`$lib/coach/api.ts`，
 * 形狀相同的欄位零映射直接沿用（多數集合型別在 data.ts 已刻意對齊桌面真實型別，
 * 例如 ClassRow/MemberRow/OrderRow/Coach，見該檔各型別附註），只在行動版 UI 真的
 * 需要不同形狀處做薄映射（例如今日課表的 tone/label、訊息列表的 MessageRow）。
 * 凡是桌面 seam 本身仍是 mock（無後端來源）的欄位，這裡原樣沿用同一份 mock/預設值
 * ——不發明桌面沒有的假來源，也不重新實作桌面已經做過的映射邏輯。逐函式來源見
 * task-20-report.md 的盤點表。 */
import {
	getVenues as adminGetVenues,
	getTickets as adminGetTickets,
	getCoaches as adminGetCoaches,
	getClasses as adminGetClasses,
	createCourse,
	updateCourse,
	mapCourse,
	getMembers as adminGetMembers,
	createMember,
	updateMember,
	createCoach,
	updateCoach,
	getOrders as adminGetOrders,
	updateOrderStatus,
	getReports as adminGetReports,
	getTodaySessions as adminGetTodaySessions,
	getRecentActivity as adminGetRecentActivity,
	getSettings,
	putSettings,
	type CourseWriteBody,
	type CreateMemberBody,
	type UpdateMemberBody,
	type CoachWriteBody,
	type SettingsData,
	type SettingsWriteBody,
	type ReportsData
} from '$lib/admin/api';
import type { CoachFormValues, TodayClass } from '$lib/admin/data';
import {
	getDashboard as coachGetDashboard,
	getAttendance as coachGetAttendance,
	saveAttendance as coachSaveAttendance,
	getStudents as coachGetStudents,
	getSettings as coachGetSettings,
	saveSettings,
	getConversations as coachGetConversations,
	getThread,
	sendMessage,
	markRead,
	createCertificate,
	createReportCard,
	CoachNotFoundError,
	type CreateCertificateBody,
	type CreateReportCardBody
} from '$lib/coach/api';
import type { Coach as CoachProfile, Conversation, ThreadMsg, Student, AttRow, AttDefault } from '$lib/coach/data';
import { fmtNT } from '$lib/format';
import {
	PROFILES,
	type Profile,
	type Coach,
	type Venue,
	type Ticket,
	type TodayRow,
	type ActivityRow,
	type ClassRow,
	type MemberRow,
	type OrderRow,
	type MessageRow,
	type RosterEntry
} from './data';

export { CoachNotFoundError };
export { coachLoadErrorCopy, GENERIC_LOAD_ERROR, type LoadErrorCopy } from '$lib/coach/load-error-copy';
export type {
	CourseWriteBody,
	CreateMemberBody,
	UpdateMemberBody,
	CreateCertificateBody,
	CreateReportCardBody,
	CoachWriteBody,
	CoachFormValues,
	SettingsData,
	SettingsWriteBody,
	ReportsData
};
export { createCourse, updateCourse, mapCourse, createMember, updateMember, createCoach, updateCoach, updateOrderStatus };
// getSettings/putSettings(GET/PUT /settings，Task F9)——桌面與行動版系統設定畫面
// 消費完全相同的欄位形狀(場館資訊/通知與自動化/帳號與安全)，零映射，直接重新匯出
// 桌面 admin/api.ts 的實作(同 createCourse 等零映射寫入端點的既有慣例)。
export { getSettings, putSettings };
// getReports(GET /reports/admin，Task P4-F3)——mobile-admin 報表分析畫面與桌面消費
// 完全相同的 ReportsData 形狀(revenue/kpis/各段彙總/courses/coaches)，零映射，直接
// 重新匯出桌面 admin/api.ts 的實作(同 getSettings/putSettings 零映射既有慣例)。
// getAdminHome() 下方已用別名 adminGetReports 內部呼叫同一支函式取兩項首頁 KPI；
// 這裡另外以 getReports 之名重新匯出供 ReportsScreen.svelte 使用。
export const getReports = adminGetReports;
// createConversation(POST /conversations，撰寫新對話)刻意不重新匯出——行動版訊息
// 中心沒有「撰寫新對話」入口(只回覆既有對話串)，重新匯出一支沒有呼叫端的函式只是
// 假裝有接這個功能。
export { saveSettings, getThread, sendMessage, markRead, createCertificate, createReportCard };

export interface MoreData {
	profiles: Record<'admin' | 'coach', Profile>;
	coaches: Coach[];
	venues: Venue[];
	tickets: Ticket[];
}
/** 更多(hub)— coaches/venues/tickets 復用桌面 admin seam(GET /coaches、/venues、
 *  /products，皆公開端點)真資料，三者互不相依，平行拉取(型別與 data.ts 的 Coach/
 *  Venue/Ticket 逐欄位相同，零映射)。
 *  // P2: profiles(身分卡姓名/大頭貼/職稱)維持 mock——純顯示用 cosmetic 資料、非
 *  寫入路徑：admin 側沒有對應的「我的管理員檔案」seam，coach 側的真身分
 *  (coachGetSettings())在只有 admin 角色的帳號上可能查無教練資料(CoachNotFoundError)。
 *  真正「誰能進入 admin/coach 分區」已 100% 由 +layout.svelte 的真 authStore 角色
 *  守門把關，這裡只是身分卡上顯示的姓名/頭像仍是示範用假資料。 */
export const getMore = async (): Promise<MoreData> => {
	const [{ coaches }, { venues }, { tickets }] = await Promise.all([
		adminGetCoaches(),
		adminGetVenues(),
		adminGetTickets()
	]);
	return { profiles: PROFILES, coaches, venues, tickets };
};

/** TodaySessionResponse 的 4 態狀態 → 行動版今日課表卡的 tone/label。同桌面
 *  coach/data.ts 的 CLASS_STATUS 標籤（done→已結束、live→上課中、soon→即將開始、
 *  wait→尚未開始）。既有的 taken(是否已點名)欄位無對應真實訊號可推導——
 *  TodaySessionResponse 不含「本場次是否已完成點名」旗標，一律不設(undefined)，
 *  讓畫面固定顯示「點名」動作按鈕，不假裝知道点名是否已完成。 */
const TODAY_STATUS_LABEL: Record<string, [string, string]> = {
	done: ['neutral', '已結束'],
	live: ['success', '上課中'],
	soon: ['warning', '即將開始'],
	wait: ['neutral', '尚未開始']
};
function mapTodayClassToRow(t: { start: string; name: string; room: string; count: number; status: string }): TodayRow {
	const [tone, label] = TODAY_STATUS_LABEL[t.status] ?? ['neutral', ''];
	return { time: t.start, name: t.name, room: t.room, count: t.count, tone, label };
}

export interface MCoachHomeData {
	coach: CoachProfile;
	coachToday: TodayRow[];
	/** 待點名班級數（GET /reports/coach 的 pending_attendance，見 §3.24）。 */
	pendingClasses: string;
	/** 待回覆訊息數（同上，unread_messages）。 */
	pendingReplies: string;
}
/** 教練 · 工作台首頁 — 復用桌面 getDashboard()(Task 19：GET /users/me + /coaches
 *  組出教練檔案、GET /sessions/today 今日課表、GET /reports/coach 待點名/待回覆
 *  KPI)，一次拿到 hero 用的真實教練身分 + 今日課表 + 兩個真實 KPI 數字。conversations
 *  (訊息預覽)桌面自己也仍是 mock(見 coach/api.ts getDashboard() 註解)，本頁不需要
 *  它，直接丟棄。找不到教練檔案時拋出 CoachNotFoundError，呼叫端(coach/+page.svelte)
 *  依 e.name 判斷改顯示「此帳號未綁定教練檔案」。 */
export const getCoachHome = async (): Promise<MCoachHomeData> => {
	const d = await coachGetDashboard();
	return {
		coach: d.coach,
		coachToday: d.todayClasses.map(mapTodayClassToRow),
		pendingClasses: d.pendingClasses,
		pendingReplies: d.pendingReplies
	};
};

/** AttRow(教練/admin 名冊列)→ 行動版 RosterEntry：mid 兼作 id(enrolment_id 本身就是
 *  穩定的列鍵)，def→default 只是欄位改名，形狀同源零損失。 */
function mapAttRow(r: AttRow): RosterEntry {
	return { id: r.mid, name: r.name, initial: r.initial, color: r.color, mid: r.mid, default: r.def };
}

export interface MAttendanceClass {
	id: string;
	/** 切換班級 FilterChips 的顯示字串（時間 + 課名），從 AttClassFull.time
	 *  ("今日 HH:MM–HH:MM") 取起始時間組成，同既有「19:00 競技啦啦隊 進階班」格式。 */
	label: string;
	roster: RosterEntry[];
}
export interface MAttendanceData {
	classes: MAttendanceClass[];
	/** 名冊載入失敗而被排除的場次課名(部分失敗隔離)；頁面以 toast 提示。 */
	failedClasses: string[];
}
/** 課堂點名 — 復用桌面 coach/api.ts 的 getAttendance()(Task 2：GET /sessions/today
 *  × 各場次 GET /sessions/{id}/roster)。桌面版本已支援「今日所有場次」而非單一
 *  硬編班級——行動版舊 mock 只有一個 ROSTER，先前的切換班級 FilterChips 因此只能
 *  提供一個選項(見舊版註解「The mock only carries ROSTER for this one class」)；
 *  接上真資料後改為如實列出「今日全部場次」，切換班級恢復原本設計的多選功能。 */
export const getAttendance = async (): Promise<MAttendanceData> => {
	const { classes, failedClasses } = await coachGetAttendance();
	return {
		classes: classes.map((c) => ({
			id: c.id,
			label: `${c.time.replace('今日 ', '').split('–')[0]} ${c.name}`,
			roster: c.roster.map(mapAttRow)
		})),
		failedClasses
	};
};

/** PUT /sessions/{id}/attendance —— 復用桌面 saveAttendance()，回應重新映射回
 *  RosterEntry[]，讓頁面以伺服器為準同步 marks(同桌面「以伺服器為準，而非樂觀本地
 *  值」的理由)。 */
export const saveAttendance = (sessionId: string, marks: Record<string, AttDefault>): Promise<RosterEntry[]> =>
	coachSaveAttendance(sessionId, marks).then((rows) => rows.map(mapAttRow));

export interface MStudentsData {
	students: Student[];
}
/** 我的學員 — 復用桌面 coach/api.ts 的 getStudents()(Task 19：GET /coaches/me/
 *  students，只回這位教練名下的學員)，取代舊 mock 對「全體 MEMBERS 用姓名字串比對
 *  coach 欄位」的克難篩選方式。回傳型別直接是真實 Student[]（無技能評量 skill/pct
 *  多筆表——後端只有單一 skill/pct 欄位，且皆為 P2 佔位值，見 coach/data.ts 附註），
 *  故拿掉舊有的獨立 SKILLS 對照表，改用 Student 本身的欄位。 */
export const getStudents = (): Promise<MStudentsData> => coachGetStudents();

export type { CoachProfile };
export interface CsettingsData {
	coach: CoachProfile;
}
/** 個人設定 — 復用桌面 coach/api.ts 的 getSettings()(GET /users/me + GET /coaches
 *  組出真實教練檔案)，取代舊 mock 對 PROFILES.coach + COACHES.find(name==='林雅婷')
 *  的拼湊方式。真實 Coach 型別沒有 years/students/classes/awards 統計欄位(這些是
 *  舊 $lib/domain/coaches 型別的行動版專屬豐富化欄位，後端從未提供)——桌面自己的
 *  coach/settings 頁在這個位置也是「Stats — sensible values derived from data /
 *  mock」的固定假數字(授課時數/學員數/年資，見 ProfileTab 上層 +page.svelte 註解)，
 *  行動版鏡射同一份桌面固定假值，不新發明第 4 個假統計(桌面只給 3 個)。 */
export const getCsettings = (): Promise<CsettingsData> => coachGetSettings();

/** 桌面 TodayClass(見 admin/api.ts getTodaySessions()，GET /sessions/today admin
 *  分支)→ 行動版 TodayRow。coach/room 的 null→「—」代換已在桌面 mapTodaySession()
 *  做過，這裡原樣沿用；tone/label 桌面也已查表算好(給 Badge 用途一致)，不重新推導；
 *  state(桌面內部推導用欄位)行動版不需要，不帶入。 */
function mapAdminTodayRow(t: TodayClass): TodayRow {
	return { time: t.time, name: t.name, coach: t.coach, room: t.room, count: t.count, tone: t.tone, label: t.label };
}

export interface MAdminHomeData {
	profiles: Record<'admin' | 'coach', Profile>;
	today: TodayRow[];
	activity: ActivityRow[];
	/** 在學學員（真：GET /reports/admin 的 members.active）。 */
	enrolledValue: string;
	/** 本月營收（真：revenue.this_month_cents，ntd() 後 fmtNT()）。 */
	revenueMonthValue: string;
}
/** 管理員 · 總覽首頁 — 復用桌面 admin/api.ts 的 getReports()(Task 15：GET
 *  /reports/admin)，只取有真實資料源的兩項 KPI（在學學員／本月營收）——同桌面
 *  admin/+page.svelte 的裁決 9：原「本週課堂」「出席偏低」兩張 KPI 卡在
 *  /reports/admin 沒有對應資料源，已隨桌面版一併移除，不留假數字；hero 硬編日期
 *  字串(dateLabel)同理移除(桌面 sub 也只剩「全館即時概況」，無日期)。
 *
 *  Task F11：today(今日課表)/activity(最新動態)改讀 GET /sessions/today(admin 分支，
 *  getTodaySessions())與 GET /reports/admin/activity(getRecentActivity())，同桌面
 *  admin/+page.svelte 接真的同一組端點；三支呼叫互不相依，平行拉取。activity 形狀
 *  與桌面 Activity 完全相同(零映射，直接沿用)；today 經 mapAdminTodayRow() 轉成行動版
 *  TodayRow 形狀。profiles 維持 mock，理由同 getMore()。 */
export const getAdminHome = async (): Promise<MAdminHomeData> => {
	const [reports, todaySessions, recentActivity] = await Promise.all([
		adminGetReports(),
		adminGetTodaySessions(),
		adminGetRecentActivity()
	]);
	return {
		profiles: PROFILES,
		today: todaySessions.sessions.map(mapAdminTodayRow),
		activity: recentActivity.activity,
		enrolledValue: String(reports.members.active),
		revenueMonthValue: fmtNT(reports.revenue.thisMonth)
	};
};

/** 集合水合(members/classes/coaches/orders 一次到位)。四者皆復用桌面 admin seam
 *  的真資料，平行拉取——members/classes/orders 皆為分頁端點(Task 17)，這裡固定抓
 *  第一頁(後端預設 per_page=20)。
 *  // P2: 行動版目前沒有 PaginationBar 可切頁，資料超過一頁時清單如實只顯示第一頁
 *  （不假裝資料齊全），也不在本次任務新蓋一套行動版分頁 UI——桌面對應頁面皆已有
 *  PaginationBar，行動版尚未跟進，記錄為後續 polish(見 task-20-report.md)。四個
 *  型別與桌面對應型別逐欄位相同(見 data.ts 各型別附註)，故零映射、直接沿用。 */
export interface OpsCollections {
	members: MemberRow[];
	classes: ClassRow[];
	coaches: Coach[];
	orders: OrderRow[];
}
export const getOpsCollections = async (): Promise<OpsCollections> => {
	const [membersRes, classesRes, coachesRes, ordersRes] = await Promise.all([
		adminGetMembers(1),
		adminGetClasses(1),
		adminGetCoaches(),
		adminGetOrders(1)
	]);
	return {
		members: membersRes.members,
		classes: classesRes.classes,
		coaches: coachesRes.coaches,
		orders: ordersRes.orders
	};
};

/** Conversation(教練/admin 對話摘要)→ 既有 MessageRow 形狀。unread 由 badge(未讀則數)
 *  是否 >0 推導；kind(會員/家長/群組)、sla 等桌面訊息中心專屬欄位行動版列表本就不
 *  顯示，不映射。 */
function mapConversationToRow(c: Conversation): MessageRow {
	return { id: c.id, from: c.name, initial: c.initial, color: c.color, preview: c.preview, time: c.time, unread: (c.badge ?? 0) > 0 };
}
/** 教練 · 訊息列表 — 復用桌面 coach/api.ts 的 getConversations()(Task 12：GET
 *  /conversations/me)，取代舊 mock 固定 12 筆訊息清單。 */
export const getMessages = async (): Promise<MessageRow[]> => {
	const { conversations } = await coachGetConversations();
	return conversations.map(mapConversationToRow);
};

export type { ThreadMsg };
