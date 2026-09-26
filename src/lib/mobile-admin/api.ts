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
import type { Coach as CoachProfile, Conversation, ThreadMsg, Student, AttRow, AttDefault, AttClassFull } from '$lib/coach/data';
import { SESSION_STATUS } from '$lib/domain/sessions';
// C4 批3(facade 純轉手退役):Coach/Venue/Ticket/ActivityRow 四型別改直取對應
// $lib/domain 各 entity 檔(原經 ./data 純轉手,零附加型別事實)——ActivityRow 改名,
// 用 import-site alias `Activity as ActivityRow` 保留本檔既有用名(:258)。
import type { Coach } from '$lib/domain/coaches';
import type { Venue } from '$lib/domain/venues';
import type { Ticket } from '$lib/domain/tickets';
import type { Activity as ActivityRow } from '$lib/domain/activity';
import type { Tone } from '$lib/api/wire';
import { fmtNT } from '$lib/format';
import {
	PROFILES,
	type Profile,
	type TodayRow,
	type ClassRow,
	type MemberRow,
	type OrderRow,
	type MessageRow
} from './data';

export { CoachNotFoundError };
export { coachLoadErrorCopy, GENERIC_LOAD_ERROR, type LoadErrorCopy } from '$lib/coach/load-error-copy';
// saveNewCoach/saveCoachEdit(新增/編輯教練兩階段 async 編排器，K4/C3)——mobile-admin 復用
// 桌面 admin/coaches/+page.svelte 同一套無狀態純函式，取代原本 inline 重抄的兩步序列；R12 起
// 由 stores.ts 的 addCoach/saveCoach 動詞包裝呼叫（見 CoachesScreen.svelte 檔頭註解）。
export { saveNewCoach, saveCoachEdit, type SaveNewCoachOutcome, type SaveCoachEditOutcome } from '$lib/admin/components/coach-save';
// C3(A3 並行任務跨任務凍結契約)：createSettingsForm/SettingsDraft 由並行任務建立中的
// $lib/admin/settings-form 供給，這裡預埋 re-export——本檔自檢時此行可能報「找不到
// 模組」，屬預期，待該模組併入後由主 agent 權威閘裁決。
export { createSettingsForm, type SettingsDraft } from '$lib/admin/settings-form';
export type {
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
// getVenues/getTickets(GET /venues、GET /products，皆公開端點，C4)——場館管理
// (VenuesScreen.svelte)/票券管理(TicketsScreen.svelte)兩個 push screen 各自非同步消費
// 真資料的薄委派 re-export(同 getReports 零映射慣例；兩支桌面 seam 已於檔頭 import 供
// getMore() 使用，這裡另以 getVenues/getTickets 之名重新匯出供兩個 screen 呼叫)。
// getTickets 沿用桌面第 1 頁口徑(呼叫端不帶 page，吃後端預設 per_page=20，與「更多」
// 樞紐 getMore() 一致)——行動版兩畫面皆無 PaginationBar，超過一頁如實只顯示第一頁。
export const getVenues = adminGetVenues;
export const getTickets = adminGetTickets;
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
 *  /products，皆公開端點)真資料，三者互不相依，平行拉取(型別即本檔頭直取
 *  $lib/domain/coaches、venues、tickets 的 Coach/Venue/Ticket——C4 批3 之後 data.ts
 *  不再持有這三型，零映射)。
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

/** TodaySessionResponse 的 4 態狀態 → 行動版今日課表卡的 tone/label。單源改查
 *  $lib/domain/sessions 的 SESSION_STATUS（admin/coach/mobile-admin 三處原本各自
 *  手抄一份查表，已隨 C4 收斂；標籤沿用原本這裡就已經是 canonical 的字面——
 *  done→已結束、live→上課中、soon→即將開始、wait→尚未開始）。t.status 是後端 wire
 *  給的鬆散 string(非 TodayStatus 窄型別)，故沿用既有的 ?? ['neutral', ''] fallback
 *  （查無對應鍵時不顯示語意，行為保真，不因單源收斂而改變）。既有的 taken(是否已
 *  點名)欄位無對應真實訊號可推導——TodaySessionResponse 不含「本場次是否已完成
 *  點名」旗標，一律不設(undefined)，讓畫面固定顯示「點名」動作按鈕，不假裝知道
 *  点名是否已完成。 */
function mapTodayClassToRow(t: { start: string; name: string; room: string; count: number; status: string }): TodayRow {
	const [tone, label] = (SESSION_STATUS as Record<string, [Tone, string] | undefined>)[t.status] ?? ['neutral', ''];
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
 *  (訊息預覽)自 C2 起改為 getDashboard() 內部 best-effort 真抓(GET /conversations/me)，
 *  本頁(教練首頁 hero)不消費它、直接丟棄——等同每次多付一次隨即丟棄的
 *  GET /conversations/me；權衡後接受(不為省這一次請求而讓 getCoachHome 另闢一條不含
 *  對話的抓取路徑)。找不到教練檔案時拋出 CoachNotFoundError，呼叫端(coach/+page.svelte)
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

/** 課堂點名 — 零映射 re-export(桌面 coach/api.ts 的 getAttendance/saveAttendance，
 *  Task 2：GET /sessions/today × 各場次 GET /sessions/{id}/roster、PUT
 *  /sessions/{id}/attendance)。
 *
 *  R10(雙生收斂，ADR 0014 §2)：行動頁改接 $lib/coach/attendance-controller，與桌面
 *  coach/attendance 頁共用同一套點名編排——原本這裡的 mapAttRow()/MAttendanceClass/
 *  MAttendanceData(mid 兼作 id、def→default 的行動版專屬 RosterEntry 形狀)已無存在
 *  必要，退役；FilterChips label 合成(時間+課名)搬進頁面 derived，不再由這裡的映射
 *  代勞。型別循既有 CoachProfile 慣例經本 seam 轉出，頁面只吃 `$lib/mobile-admin/api`，
 *  不越過 seam 直取 `$lib/coach/data`（見 routes/mobile-admin/coach/attendance/
 *  +page.svelte）。 */
export { getAttendance, saveAttendance } from '$lib/coach/api';
export type { AttRow, AttDefault, AttClassFull };

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
 *  第一頁(後端預設 per_page=20)。coaches 直接取 getClasses() 回應裡的 coaches(同一支
 *  listCoaches() + mapCoach() 映射，與 getCoaches() 形狀相同)，不再另打一次 GET /coaches。
 *  // P2: 行動版目前沒有 PaginationBar 可切頁，資料超過一頁時清單如實只顯示第一頁
 *  （不假裝資料齊全），也不在本次任務新蓋一套行動版分頁 UI——桌面對應頁面皆已有
 *  PaginationBar，行動版尚未跟進，記錄為後續 polish(見 task-20-report.md)。R12 起
 *  分頁 meta(total/perPage)一併帶出(pages)，頁面據此顯示真實總數與「僅搜尋前 N 筆」
 *  提示。四個型別與桌面對應型別逐欄位相同(見 data.ts 各型別附註)，故零映射、直接沿用。 */
export interface PageInfo {
	total: number;
	perPage: number;
}
export interface OpsPages {
	members: PageInfo;
	classes: PageInfo;
	orders: PageInfo;
}
export interface OpsCollections {
	members: MemberRow[];
	classes: ClassRow[];
	coaches: Coach[];
	orders: OrderRow[];
	pages: OpsPages;
}
export const getOpsCollections = async (): Promise<OpsCollections> => {
	const [membersRes, classesRes, ordersRes] = await Promise.all([
		adminGetMembers(1),
		adminGetClasses(1),
		adminGetOrders(1)
	]);
	return {
		members: membersRes.members,
		classes: classesRes.classes,
		coaches: classesRes.coaches,
		orders: ordersRes.orders,
		pages: {
			members: { total: membersRes.total, perPage: membersRes.perPage },
			classes: { total: classesRes.total, perPage: classesRes.perPage },
			orders: { total: ordersRes.total, perPage: ordersRes.perPage }
		}
	};
};

/** Conversation(教練/admin 對話摘要)→ 既有 MessageRow 形狀。unread 由 badge(未讀則數)
 *  是否 >0 推導；kind(會員/家長/群組)這類桌面訊息中心專屬欄位行動版列表本就不
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
