/* Dream Fly — 行動管理端 API 接縫：組合桌面 admin/coach seams(`$lib/admin/api`、
 * `$lib/coach/api`)的薄層。形狀相同的欄位零映射直接沿用，只在行動版 UI 真的需要不同
 * 形狀處做薄映射；桌面 seam 本身仍是 mock(無後端來源)的欄位原樣沿用同一份 mock/預設值。
 *
 * 本檔只留真正做「組合(平行拉取多支端點)＋薄映射」的 3 支：getMore/getCoachHome/
 * getAdminHome。零映射的轉手一律不留(ADR-0019 C4)，消費端直接 import 擁有者模組
 * (名稱衝突時在 import 處 alias，不回本檔開轉手)；
 * ops 集合(members/classes/coaches/orders)由 $lib/mobile-admin/stores 的三個水合單位
 * 直接向 $lib/admin/api 取第 1 頁。 */
import {
	getVenues as adminGetVenues,
	getTickets as adminGetTickets,
	getCoaches as adminGetCoaches,
	getReports as adminGetReports,
	getTodaySessions as adminGetTodaySessions,
	getRecentActivity as adminGetRecentActivity
} from '$lib/admin/api';
import type { TodayClass } from '$lib/admin/data';
import { getDashboard as coachGetDashboard } from '$lib/coach/api';
import type { Coach as CoachProfile, TodayClass as CoachTodayClass } from '$lib/coach/data';
// C4 批3(facade 純轉手退役):Coach/Venue/Ticket/ActivityRow 四型別改直取對應
// $lib/domain 各 entity 檔(原經 ./data 純轉手,零附加型別事實)——ActivityRow 改名,
// 用 import-site alias `Activity as ActivityRow` 保留本檔既有用名(:258)。
import type { Coach } from '$lib/domain/coaches';
import type { Venue } from '$lib/domain/venues';
import type { Ticket } from '$lib/domain/tickets';
import type { Activity as ActivityRow } from '$lib/domain/activity';
import { fmtNT } from '$lib/format';
import { PROFILES, type Profile } from './data';

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

export interface MCoachHomeData {
	coach: CoachProfile;
	coachToday: CoachTodayClass[];
	/** 待點名班級數（GET /reports/coach 的 pending_attendance，見 §3.24）。 */
	pendingClasses: string;
	/** 待回覆訊息數（同上，unread_messages）。 */
	pendingReplies: string;
}
/** 教練 · 工作台首頁 — 復用桌面 getDashboard()(Task 19：GET /users/me + /coaches
 *  組出教練檔案、GET /sessions/today 今日課表、GET /reports/coach 待點名/待回覆
 *  KPI)，一次拿到 hero 用的真實教練身分 + 今日課表 + 兩個真實 KPI 數字。getDashboard 不再
 *  抓對話(R20 候選 02:最新訊息由 $lib/coach/conversations 的列表衍生),所以本頁不再多付
 *  一次隨即丟棄的 GET /conversations/me。找不到教練檔案時拋出 CoachNotFoundError，呼叫端(coach/+page.svelte)
 *  依 e.name 判斷改顯示「此帳號未綁定教練檔案」。 */
export const getCoachHome = async (): Promise<MCoachHomeData> => {
	const d = await coachGetDashboard();
	return {
		coach: d.coach,
		coachToday: d.todayClasses,
		pendingClasses: d.pendingClasses,
		pendingReplies: d.pendingReplies
	};
};

export interface MAdminHomeData {
	profiles: Record<'admin' | 'coach', Profile>;
	today: TodayClass[];
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
 *  與桌面 Activity 完全相同(零映射，直接沿用)；today 同樣直接沿用桌面 TodayClass(R18：
 *  TodayRow 與轉抄 mapper 已退役)。profiles 維持 mock，理由同 getMore()。 */
export const getAdminHome = async (): Promise<MAdminHomeData> => {
	const [reports, todaySessions, recentActivity] = await Promise.all([
		adminGetReports(),
		adminGetTodaySessions(),
		adminGetRecentActivity()
	]);
	return {
		profiles: PROFILES,
		today: todaySessions.sessions,
		activity: recentActivity.activity,
		enrolledValue: String(reports.members.active),
		revenueMonthValue: fmtNT(reports.revenue.thisMonth)
	};
};
