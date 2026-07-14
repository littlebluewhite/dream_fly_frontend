/* Dream Fly — 行動版會員 App · mock data + helpers (ported from mobile/data.jsx).
 *
 * Task 19：`getHome()`/`getCourses()`/`getMine()`/`getAccount()`/`getNotifications()`
 * 在 `$lib/mobile/api.ts` 已改接真後端(復用 `$lib/member/api.ts` 的既有 seam)。
 * Task 1(C2 死種子退役)：本檔案原本混合兩種常數——(a) 仍是畫面唯一資料源的 mock、
 * (b) 已無 production 消費者、僅供既有測試當 fixture 用的舊 mock(如 CATALOG)。
 * 經逐一確認 runtime 消費者後，(b) 類整批退役(STATS/SKILLS/SCHEDULE/ORDERS/
 * MAKEUP_SLOTS/REWARDS/REPORTS/UPCOMING/MY_COURSES/POINTS_LEDGER/CERTS 的轉出行、
 * CATALOG 本地值)，對應測試改為檔內 inline fixture(見各測試檔)。現存常數皆為
 * (a) 畫面仍在讀的 mock(ANNOUNCE、COACH_REPLIES — 對應桌面版同樣是 mock，見各自
 * 的 P2 註解)、查表、或 `$lib/domain/member-app` 轉出的活值/活型別。 */

export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** Tone tuple — [semantic tone key, Traditional-Chinese label]. */
export type Tone = [string, string];

/* ---- single-source domain seed ----
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生 —— 值相等的 seed 常數集中在
 * `$lib/domain/member-app`；這裡 pass-through 值 + 型別(名稱不同時用
 * `export type { X as Y }` 別名)。mobile 的公開 API 不變。ANNOUNCE 因兩側有一則
 * 公告的 bg 色不同，留在本檔案原地(見下方),未搬進 domain。
 *
 * Task 1(C2 死種子退役)：STATS/SKILLS/SCHEDULE/ORDERS/MAKEUP_SLOTS/REWARDS/
 * REPORTS/UPCOMING 的轉出(值+型別)經確認這個 facade 本身無 runtime 消費者(mobile
 * 頁面走真後端接縫，或如 STATS/SKILLS 一樣只有桌面 member/api.ts 在用)後移除。
 * MY_COURSES/POINTS_LEDGER/CERTS 只刪值(仍有測試以外的型別消費者用得到別名型
 * 別)：MyCourse/PointsEntry/Cert 型別中，MyCourse 供多個 overlay 元件消費而保留，
 * PointsEntry/Cert 一併確認無型別消費者後隨值整組退役。 */
export { ME, type Member } from '$lib/domain/member-app';
// STATS/SKILLS(值+型別)不在此列——Task 1 確認這份 facade 的轉出無 runtime 消費者
// (僅桌面 member/api.ts 消費自己那份 member/data.ts 轉出)後移除。
// ATT_HISTORY 不在此列——Task F7 出勤明細改走真 GET /enrolments/{id}/attendance
// (MyCourseDetail.svelte 經 mobile/api.ts 轉發桌面 member/api.ts 的 getEnrolmentAttendance())，
// 這份 mock 已無 runtime 消費者。
export type { AttRecord } from '$lib/domain/member-app';
// SCHEDULE/ORDERS/MAKEUP_SLOTS/REWARDS/REPORTS(值+型別)不在此列——mobile/api.ts
// 直接從 domain 匯入 ScheduleBlock/Order 型別(不經這個 facade)，Reward 型別另有
// member/api.ts 的真實版本；四者的轉出本身皆無 runtime 消費者，Task 1 確認後移除。
// Named differently on this side than in domain/member — preserve mobile's own names.
// UPCOMING/Upcoming 不在此列——Task 1 確認無 runtime 消費者(含測試)後移除。
export type { EnrolledCourse as MyCourse } from '$lib/domain/member-app';
export { CONTACT_THREAD } from '$lib/domain/member-app';
export type { ChatMessage as ThreadMsg } from '$lib/domain/member-app';
export { NOTIFS_SEED } from '$lib/domain/member-app';
export type { Notification as NotifItem } from '$lib/domain/member-app';
// POINTS_LEDGER/PointsEntry、CERTS/Cert 不在此列——Task 1 確認兩者的轉出(值+型別)
// 皆無 runtime 消費者後移除；domain 本體的 Certificate/CERTS 隨後也整段退役。
import type { CatalogCourse } from '$lib/public/adapters';
import { LEVEL_TONE as LEVEL_TONE_BASE } from '$lib/domain/course-level';
import { NOTIF_CATS as NOTIF_CATS_BASE } from '$lib/domain/member-app';
import type { IconName } from '$lib/icon-registry';

/* ---- Attendance history (active course) ----
 * 'late'(遲到)鍵已移除（Task F7）：後端 attendance_status enum(§3.12)只有
 * present/absent/leave 三值。 */
export const ATT_STATE: Record<string, Tone> = { present: ['success', '出席'], leave: ['info', '請假'], absent: ['error', '缺席'] };

/* ---- Course catalog (課程介紹) ----
 * Task 19：getCourses()/getHome() 改接真後端(見 api.ts，復用 member/api.ts 的
 * getCourses() —— $lib/public/adapters 的 CatalogCourse，id 是後端 uuid string，
 * 沒有 icon 欄位)。這裡的 Course 改為擴充該真實形狀 + 補一個 icon 欄位(api.ts
 * 依課程分類薄映射)，id 型別由 number 改 string。 */
export interface Course extends CatalogCourse {
	icon: IconName;
}
// Task 1(C2 死種子退役)：CATALOG(值)已退役——getCourses()/getHome() 已改真接
// 後端，這份 mock 已無 runtime 消費者；曾經的「僅供既有測試當 fixture 用」用途
// 也已改為各測試檔內的 inline Course fixture。Course interface(見上)仍供
// api.ts/元件的型別標註使用，保留。
// 批次 2 W2b：LEVEL_TONE 改純註記 re-assert 自 $lib/domain/course-level（批次 1 W2a
// 已單源收斂 5 級對照）；保留本檔既有 Record<string, string> 寬鍵（LevelBadge.svelte
// 等消費端吃鬆散 string）。
export const LEVEL_TONE: Record<string, string> = LEVEL_TONE_BASE;

/* ---- Weekly schedule grid ---- */
export { WEEK } from '$lib/domain/member-app';
// TIME_ROWS 不在此列——mobile 側零消費者，死出口不留（ADR 0010 精神）。

/* ---- Announcements (home) — kept local: member's 3rd item has a different `bg`. ---- */
export interface Announce {
	icon: IconName;
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
export const NOTIF_CATS: Tone[] = NOTIF_CATS_BASE;
export const NOTIF_TONE_BG: Record<string, string> = { primary: 'var(--df-primary-bg)', info: 'var(--df-info-bg)', success: 'var(--df-success-bg)', warning: 'var(--df-warning-bg)', accent: '#FFF8DB' };
export const NOTIF_TONE_FG: Record<string, string> = { primary: 'var(--df-primary)', info: 'var(--df-info)', success: 'var(--df-success)', warning: 'var(--df-warning)', accent: 'var(--df-accent-dark)' };

/* ---- Member points (點數明細與兌換) ---- */
export const PT_TYPE: Record<string, Tone> = { earn: ['success', '獲得'], redeem: ['primary', '折抵'], expire: ['neutral', '到期'] };

/* ---- Canned coach replies (聯絡教練 / 訊息 — 罐頭回覆;CONTACT_THREAD 本體在 $lib/domain/member-app) ---- */
export { COACH_REPLIES } from '$lib/domain/member-app';
