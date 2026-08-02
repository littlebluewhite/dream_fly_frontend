/* Dream Fly — 行動版會員 App · mock data + helpers (ported from mobile/data.jsx).
 *
 * Task 19：`getHome()`/`getCourses()`/`getMine()`/`getAccount()`/`getNotifications()`
 * 在 `$lib/mobile/api.ts` 已改接真後端(復用 `$lib/member/api.ts` 的既有 seam)。
 * Task 1(C2 死種子退役)：本檔案原本混合兩種常數——(a) 仍是畫面唯一資料源的 mock、
 * (b) 已無 production 消費者、僅供既有測試當 fixture 用的舊 mock(如 CATALOG)。
 * 經逐一確認 runtime 消費者後，(b) 類整批退役(STATS/SKILLS/SCHEDULE/ORDERS/
 * MAKEUP_SLOTS/REWARDS/REPORTS/UPCOMING/MY_COURSES/POINTS_LEDGER/CERTS 的轉出行、
 * CATALOG 本地值)，對應測試改為檔內 inline fixture(見各測試檔)。C4 批1(facade
 * 純轉手退役)接續移除本檔對 domain/member-app 的純轉手值/型別轉出，消費端改直取
 * 單源。現存常數皆為 (a) 畫面仍在讀的本地 mock(ANNOUNCE — 對應桌面版同樣是
 * mock，見 P2 註解)、查表，或對 domain 值純註記收窄的 LEAVE_STATUS/LEVEL_TONE。 */

/** Tone tuple — [semantic tone key, Traditional-Chinese label]. */
export type Tone = [string, string];

// C4 批1(facade 純轉手退役):ME/type Member、AttRecord、EnrolledCourse as
// MyCourse、CONTACT_THREAD、ChatMessage as ThreadMsg、NOTIFS_SEED、Notification
// as NotifItem、WEEK、COACH_REPLIES、NOTIF_CATS(下方「Notification center」段落)
// 十組 domain/member-app 純轉手匯出——不攜帶本檔型別事實、不做值變形——整批退役;
// 消費端改直取 $lib/domain/member-app 同名同型符號(改名一律 import-site alias)。
// ANNOUNCE 因兩側有一則公告的 bg 色不同,留在本檔案原地(見下方),未搬進 domain。
import type { CatalogCourse } from '$lib/public/adapters';
import { LEVEL_TONE as LEVEL_TONE_BASE } from '$lib/domain/course-level';
import { LEAVE_STATUS as LEAVE_STATUS_BASE } from '$lib/domain/member-app';
import type { IconName } from '$lib/icon-registry';

/* ---- Attendance history (active course) ----
 * 'late'(遲到)鍵已移除（Task F7）：後端 attendance_status enum(§3.12)只有
 * present/absent/leave 三值。 */
export const ATT_STATE: Record<string, Tone> = { present: ['success', '出席'], leave: ['info', '請假'], absent: ['error', '缺席'] };

/* ---- 「我的請假」清單狀態 badge ----
 * 卡 3：LEAVE_STATUS 升遷 $lib/domain/member-app 單源（MyCourseDetail 原跨 surface
 * 直取 member/data，改經本 facade）——以本檔 tuple Tone 對同一參照純註記收窄、
 * 鍵保持鬆散 string（消費端用 `LEAVE_STATUS[lr.status] ?? ['neutral', lr.status]`
 * 取值），零斷言（ADR 0013 facade 三形之 member/mobile 收窄形）。 */
export const LEAVE_STATUS: Record<string, Tone> = LEAVE_STATUS_BASE;

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

// TIME_ROWS 不在此列——mobile 側零消費者，死出口不留（ADR 0010 精神）。WEEK 已隨 C4
// 批1(見上方)退役,消費端改直取 $lib/domain/member-app。

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
export const NOTIF_TONE_BG: Record<string, string> = { primary: 'var(--df-primary-bg)', info: 'var(--df-info-bg)', success: 'var(--df-success-bg)', warning: 'var(--df-warning-bg)', accent: '#FFF8DB' };
export const NOTIF_TONE_FG: Record<string, string> = { primary: 'var(--df-primary)', info: 'var(--df-info)', success: 'var(--df-success)', warning: 'var(--df-warning)', accent: 'var(--df-accent-dark)' };

/* ---- Member points (點數明細與兌換) ---- */
export const PT_TYPE: Record<string, Tone> = { earn: ['success', '獲得'], redeem: ['primary', '折抵'], expire: ['neutral', '到期'] };
