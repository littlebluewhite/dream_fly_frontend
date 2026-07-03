/* Dream Fly — 行動版會員 App · mock data + helpers (ported from mobile/data.jsx).
 *
 * Mock-only, no backend — typed `const` exports mirroring the prototype's data
 * verbatim (member 王承恩, ties to admin GY2024001). Screens read these; the
 * stores seed their initial state from NOTIFS_SEED / ME.points / ME profile. */

export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** Tone tuple — [semantic tone key, Traditional-Chinese label]. */
export type Tone = [string, string];

/* ---- single-source domain seed ----
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生 —— 值相等的 seed 常數集中在
 * `$lib/domain/member-app`；這裡 pass-through 值 + 型別(名稱不同時用
 * `export type { X as Y }` 別名)，或匯入基底值後保留自己原本的 interface(CATALOG
 * 的 Course 多一個 index signature，形狀有出入)。mobile 的公開 API 不變。ANNOUNCE
 * 因兩側有一則公告的 bg 色不同，留在本檔案原地(見下方),未搬進 domain。 */
export { ME, type Member } from '$lib/domain/member-app';
export { STATS, type Stat } from '$lib/domain/member-app';
export { SKILLS, type Skill } from '$lib/domain/member-app';
export { ATT_HISTORY, type AttRecord } from '$lib/domain/member-app';
export { SCHEDULE, type ScheduleBlock } from '$lib/domain/member-app';
export { ORDERS, type Order } from '$lib/domain/member-app';
export { MAKEUP_SLOTS, type MakeupSlot } from '$lib/domain/member-app';
export { REWARDS, type Reward } from '$lib/domain/member-app';
export { REPORTS, type Report } from '$lib/domain/member-app';
// Named differently on this side than in domain/member — preserve mobile's own names.
export { UPCOMING } from '$lib/domain/member-app';
export type { UpcomingClass as Upcoming } from '$lib/domain/member-app';
export { MY_COURSES } from '$lib/domain/member-app';
export type { EnrolledCourse as MyCourse } from '$lib/domain/member-app';
export { CONTACT_THREAD } from '$lib/domain/member-app';
export type { ChatMessage as ThreadMsg } from '$lib/domain/member-app';
export { NOTIFS_SEED } from '$lib/domain/member-app';
export type { Notification as NotifItem } from '$lib/domain/member-app';
export { POINTS_LEDGER } from '$lib/domain/member-app';
export type { LedgerEntry as PointsEntry } from '$lib/domain/member-app';
export { CERTS } from '$lib/domain/member-app';
export type { Certificate as Cert } from '$lib/domain/member-app';
// CATALOG's shape differs (Course below carries an extra index signature for the
// cart), so keep this file's own interface and only source the value from domain.
import { CATALOG as CATALOG_BASE } from '$lib/domain/member-app';

/* ---- Attendance history (active course) ---- */
export const ATT_STATE: Record<string, Tone> = { present: ['success', '出席'], late: ['warning', '遲到'], leave: ['info', '請假'], absent: ['error', '缺席'] };

/* ---- Course catalog (課程介紹) ---- */
export interface Course {
	id: number;
	name: string;
	level: string;
	cat: string;
	age: string;
	icon: string;
	days: string;
	price: number;
	hot: boolean;
	coach: string;
	desc: string;
	spots: number;
	/* index signature so a Course satisfies the cart's CartInput (carries the
	 * extra fields — icon / level / desc … — verbatim into a cart line). */
	[k: string]: unknown;
}
// domain's CatalogCourse has no index signature; assert it into this file's Course.
export const CATALOG: Course[] = CATALOG_BASE as Course[];
export const LEVEL_TONE: Record<string, string> = { 啟蒙: 'info', 入門: 'info', 基礎: 'primary', 進階: 'warning', 選手: 'accent' };

/* ---- Weekly schedule grid ---- */
export const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
export const TIME_ROWS = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

/* ---- Announcements (home) — kept local: member's 3rd item has a different `bg`. ---- */
export interface Announce {
	icon: string;
	tone: string;
	bg: string;
	title: string;
	body: string;
	time: string;
}
export const ANNOUNCE: Announce[] = [
	{ icon: 'megaphone', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '暑期特訓營開放報名', body: '7/15–8/20 競技體操暑期營，早鳥優惠至 6/30。', time: '2 天前' },
	{ icon: 'calendar-off', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '端午連假停課公告', body: '6/14–6/16 全館停課，請留意補課時段。', time: '5 天前' },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', title: '市賽報名開始', body: '台中市體操錦標賽選手班報名開放中。', time: '1 週前' }
];

/* ---- Upcoming sessions per enrolled course — used by the 請假 form ---- */
export const COURSE_SESSIONS: Record<string, string[]> = {
	k1: ['2026/06/11 (四) 19:00–20:30', '2026/06/16 (二) 19:00–20:30', '2026/06/18 (四) 19:00–20:30', '2026/06/23 (二) 19:00–20:30'],
	k6: ['2026/06/12 (五) 17:00–19:00', '2026/06/19 (五) 17:00–19:00', '2026/06/26 (五) 17:00–19:00'],
	k8: ['2026/06/13 (五) 18:00–19:00', '2026/06/20 (五) 18:00–19:00', '2026/06/27 (五) 18:00–19:00']
};
export const LEAVE_REASONS = ['生病 / 身體不適', '家庭因素', '學校活動', '出國 / 旅遊', '其他'];

/* ---- Notification center (通知中心) ---- */
export const NOTIF_CATS: Tone[] = [['all', '全部'], ['class', '課程'], ['order', '訂單'], ['coach', '教練'], ['system', '系統']];
export const NOTIF_TONE_BG: Record<string, string> = { primary: 'var(--df-primary-bg)', info: 'var(--df-info-bg)', success: 'var(--df-success-bg)', warning: 'var(--df-warning-bg)', accent: '#FFF8DB' };
export const NOTIF_TONE_FG: Record<string, string> = { primary: 'var(--df-primary)', info: 'var(--df-info)', success: 'var(--df-success)', warning: 'var(--df-warning)', accent: 'var(--df-accent-dark)' };

/* ---- Member points (點數明細與兌換) ---- */
export const PT_TYPE: Record<string, Tone> = { earn: ['success', '獲得'], redeem: ['primary', '折抵'], expire: ['neutral', '到期'] };

/* ---- Canned coach replies (聯絡教練 / 訊息 — 罐頭回覆;CONTACT_THREAD 本體在 $lib/domain/member-app) ---- */
export const COACH_REPLIES = ['收到！我會留意，謝謝家長。', '好的，我們課堂上再幫承恩加強。', '沒問題，有任何狀況都歡迎隨時跟我說 🙂', '了解～這部分我會特別注意。'];
