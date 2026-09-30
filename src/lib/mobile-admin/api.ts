/* Dream Fly — 行動管理端 API 接縫。Task 20：從整包 reply() mock 改為 desktop
 * admin/coach seams 的薄層——直接 import `$lib/admin/api.ts`/`$lib/coach/api.ts`，
 * 形狀相同的欄位零映射直接沿用（多數集合型別在 data.ts 已刻意對齊桌面真實型別，
 * 例如 ClassRow/MemberRow/OrderRow/Coach，見該檔各型別附註），只在行動版 UI 真的
 * 需要不同形狀處做薄映射（例如今日課表的 tone/label、訊息列表的 MessageRow）。
 * 凡是桌面 seam 本身仍是 mock（無後端來源）的欄位，這裡原樣沿用同一份 mock/預設值
 * ——不發明桌面沒有的假來源，也不重新實作桌面已經做過的映射邏輯。逐函式來源見
 * task-20-report.md 的盤點表。
 *
 * R15 Task 3b(候選 轉手退役)：本檔原本還轉出約 40 支對桌面 admin/coach seam 的零
 * 映射 re-export（新增/編輯/報表/設定/課堂點名/我的學員/個人設定/訊息中心…），
 * 對外只是換一個 import 路徑、沒有加任何型別事實或映射邏輯——依 ADR-0019 C4 的
 * facade 退役判準全數刪除，生產消費端改直接 import 擁有者模組（$lib/admin/api、
 * $lib/admin/data、$lib/admin/components/coach-save、$lib/admin/settings-form、
 * $lib/coach/api、$lib/coach/load-error-copy、$lib/coach/data）。本檔只留真正做
 * 「組合(平行拉取多支端點)＋薄映射」的 5 支：getMore/getCoachHome/getAdminHome/
 * getOpsCollections/getMessages。 */
import {
	getVenues as adminGetVenues,
	getTickets as adminGetTickets,
	getCoaches as adminGetCoaches,
	getClasses as adminGetClasses,
	getMembers as adminGetMembers,
	getOrders as adminGetOrders,
	getReports as adminGetReports,
	getTodaySessions as adminGetTodaySessions,
	getRecentActivity as adminGetRecentActivity
} from '$lib/admin/api';
import type { TodayClass, ClassRow, MemberAccount as MemberRow, Order as OrderRow } from '$lib/admin/data';
import { getDashboard as coachGetDashboard, getConversations as coachGetConversations } from '$lib/coach/api';
import type { Coach as CoachProfile, Conversation } from '$lib/coach/data';
import { SESSION_STATUS } from '$lib/domain/sessions';
import type { TodayStatus } from '$lib/domain/sessions';
// C4 批3(facade 純轉手退役):Coach/Venue/Ticket/ActivityRow 四型別改直取對應
// $lib/domain 各 entity 檔(原經 ./data 純轉手,零附加型別事實)——ActivityRow 改名,
// 用 import-site alias `Activity as ActivityRow` 保留本檔既有用名(:258)。
import type { Coach } from '$lib/domain/coaches';
import type { Venue } from '$lib/domain/venues';
import type { Ticket } from '$lib/domain/tickets';
import type { Activity as ActivityRow } from '$lib/domain/activity';
import { fmtNT } from '$lib/format';
import {
	PROFILES,
	type Profile,
	type TodayRow,
	type MessageRow
} from './data';

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

/** coach TodayClass.status(TodayStatus 窄型別)→ 行動版今日課表卡的 tone/label。單源
 *  改查 $lib/domain/sessions 的 SESSION_STATUS（admin/coach/mobile-admin 三處原本各自
 *  手抄一份查表，已隨 C4 收斂；標籤沿用原本這裡就已經是 canonical 的字面——
 *  done→已結束、live→上課中、soon→即將開始、wait→尚未開始）。t.status 現直接是
 *  TodayStatus 窄型別（C5：coach/api.ts 的 mapTodayClass 回傳形狀本就是窄型別，先前
 *  這裡的寬鍵 Record<string,…> ?? fallback 是不必要的轉型——查表恆有對應，直接索引
 *  即可，查無鍵是編譯期錯誤而非執行期 fallback）。既有的 taken(是否已點名)欄位無
 *  對應真實訊號可推導——TodaySessionResponse 不含「本場次是否已完成點名」旗標，一律
 *  不設(undefined)，讓畫面固定顯示「點名」動作按鈕，不假裝知道点名是否已完成。 */
function mapTodayClassToRow(t: { start: string; name: string; room: string; count: number; status: TodayStatus }): TodayRow {
	const [tone, label] = SESSION_STATUS[t.status];
	return { time: t.start, name: t.name, room: t.room, count: t.count, state: t.status, tone, label };
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

/** 桌面 TodayClass(見 admin/api.ts getTodaySessions()，GET /sessions/today admin
 *  分支)→ 行動版 TodayRow。coach/room 的 null→「—」代換已在桌面 mapTodaySession()
 *  做過，這裡原樣沿用；tone/label 桌面也已查表算好(給 Badge 用途一致)，不重新推導；
 *  state(C5)一併帶過去——首頁「進行中課堂」橫幅據此判斷，不再比對 label 字面。 */
function mapAdminTodayRow(t: TodayClass): TodayRow {
	return { time: t.time, name: t.name, coach: t.coach, room: t.room, count: t.count, state: t.state, tone: t.tone, label: t.label };
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
 *  是否 >0 推導。 */
function mapConversationToRow(c: Conversation): MessageRow {
	return { id: c.id, from: c.name, initial: c.initial, color: c.color, preview: c.preview, time: c.time, unread: (c.badge ?? 0) > 0 };
}
/** 教練 · 訊息列表 — 復用桌面 coach/api.ts 的 getConversations()(Task 12：GET
 *  /conversations/me)，取代舊 mock 固定 12 筆訊息清單。 */
export const getMessages = async (): Promise<MessageRow[]> => {
	const { conversations } = await coachGetConversations();
	return conversations.map(mapConversationToRow);
};
