/* Dream Fly — 行動版會員 App · mock data + helpers (ported from mobile/data.jsx).
 *
 * Task 19：`getHome()`/`getCourses()`/`getMine()`/`getAccount()`/`getNotifications()`
 * 在 `$lib/mobile/api.ts` 已改接真後端(復用 `$lib/member/api.ts` 的既有 seam)——
 * 這個檔案現在混合兩種常數：(a) 仍是畫面唯一資料源的 mock(如 ANNOUNCE、
 * COACH_REPLIES — 對應的桌面版同樣是 mock，見各自的 P2 註解)；(b) 已改為
 * 「只供既有測試當 fixture 用、production code 不再讀取」的舊 mock(如
 * CATALOG — 見下方個別註解)。 */

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
// ATT_HISTORY 不在此列——Task F7 出勤明細改走真 GET /enrolments/{id}/attendance
// (MyCourseDetail.svelte 直接復用桌面 member/api.ts 的 getEnrolmentAttendance())，
// 這份 mock 已無 runtime 消費者。
export type { AttRecord } from '$lib/domain/member-app';
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
import type { CatalogCourse } from '$lib/public/adapters';

/* ---- Attendance history (active course) ----
 * 'late'(遲到)鍵已移除（Task F7）：後端 attendance_status enum(§3.12)只有
 * present/absent/leave 三值。 */
export const ATT_STATE: Record<string, Tone> = { present: ['success', '出席'], leave: ['info', '請假'], absent: ['error', '缺席'] };

/* ---- Course catalog (課程介紹) ----
 * Task 19：getCourses()/getHome() 改接真後端(見 api.ts，復用 member/api.ts 的
 * getCourses() —— $lib/public/adapters 的 CatalogCourse，id 是後端 uuid string，
 * 沒有 icon 欄位)。這裡的 Course 改為擴充該真實形狀 + 補一個 icon 欄位(api.ts
 * 依課程分類薄映射)，id 型別由 number 改 string。 index signature 保留，讓
 * Course 仍滿足購物車 CartInput 的形狀(把 icon/level/desc…等欄位原樣帶進
 * cart line)。 */
export interface Course extends CatalogCourse {
	icon: string;
	[k: string]: unknown;
}
/** 僅供既有測試當 fixture 用(data.test.ts 形狀測試、courses/page.test.ts 候補
 *  守門測試、home page.test.ts)—— getCourses()/getHome() 已改真接後端，
 *  production code 不再讀這個常數；id 由舊 mock 的 number 改 string，對齊
 *  Course 型別(見上)。 */
export const CATALOG: Course[] = [
	{ id: '1', name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', age: '3–5 歲', icon: 'baby', days: '週六 10:00', price: 2800, hot: false, coach: '黃詩涵', desc: '透過遊戲與軟墊活動建立平衡、協調與身體覺察，循序漸進培養孩子對體操的興趣。', spots: 2 },
	{ id: '2', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', age: '7–9 歲', icon: 'rotate-cw', days: '週一 / 週三 17:30', price: 3200, hot: true, coach: '陳冠宇', desc: '從前滾翻、後滾翻到基礎倒立，建立扎實的體操底子，每班 6–8 人小班制。', spots: 2 },
	{ id: '3', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', icon: 'sparkles', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。小班 12 人內、雙教練保護。', spots: 1 },
	{ id: '4', name: '成人體操 基礎班', level: '基礎', cat: '成人體操', age: '16 歲以上', icon: 'dumbbell', days: '週五 20:00', price: 3600, hot: false, coach: '王思齊', desc: '為成人設計的入門體操，著重柔軟度、核心力量與安全保護，零基礎可上。', spots: 3 },
	{ id: '5', name: '跑酷入門班', level: '入門', cat: '跑酷', age: '12 歲以上', icon: 'flame', days: '週日 15:00', price: 3400, hot: false, coach: '王思齊', desc: '在安全環境中學習翻越、落地與移動技巧，建立空間判斷與身體控制。', spots: 0 },
	{ id: '6', name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', age: '2–4 歲', icon: 'heart', days: '週日 10:00', price: 2600, hot: false, coach: '黃詩涵', desc: '家長與孩子一起參與，透過親子互動建立信任與運動習慣。', spots: 3 }
];
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

/* ---- Notification center (通知中心) ---- */
export const NOTIF_CATS: Tone[] = [['all', '全部'], ['class', '課程'], ['order', '訂單'], ['coach', '教練'], ['system', '系統']];
export const NOTIF_TONE_BG: Record<string, string> = { primary: 'var(--df-primary-bg)', info: 'var(--df-info-bg)', success: 'var(--df-success-bg)', warning: 'var(--df-warning-bg)', accent: '#FFF8DB' };
export const NOTIF_TONE_FG: Record<string, string> = { primary: 'var(--df-primary)', info: 'var(--df-info)', success: 'var(--df-success)', warning: 'var(--df-warning)', accent: 'var(--df-accent-dark)' };

/* ---- Member points (點數明細與兌換) ---- */
export const PT_TYPE: Record<string, Tone> = { earn: ['success', '獲得'], redeem: ['primary', '折抵'], expire: ['neutral', '到期'] };

/* ---- Canned coach replies (聯絡教練 / 訊息 — 罐頭回覆;CONTACT_THREAD 本體在 $lib/domain/member-app) ---- */
export const COACH_REPLIES = ['收到！我會留意，謝謝家長。', '好的，我們課堂上再幫承恩加強。', '沒問題，有任何狀況都歡迎隨時跟我說 🙂', '了解～這部分我會特別注意。'];
