/* src/lib/domain/member-app.ts — 會員 app(member 桌面 / mobile 手機雙生)共用 seed 單一來源。
 * 值逐位元組沿用 member 側;僅收值相等的常數 —— 自 ADR 0013 起含顯示查表/成對常數;Tone 等 facade 專屬型別仍留各 facade。
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生，data.ts 近乎重複(同 persona
 * 王承恩 GY2024001)。這裡只收兩側 JSON.stringify 深度相等的常數 —— ANNOUNCE 有一筆
 * 公告的 bg 色兩側不同(member 'var(--df-accent-bg)' vs mobile '#FFF8DB')，因此整個
 * ANNOUNCE 留在原地(member/data.ts、mobile/data.ts 各自的字面陣列)，不搬進這裡。
 *
 * 型別策略:形狀完全相同(同名或僅名稱不同)的 interface 直接上移，兩側 facade
 * pass-through(名稱不同時用 `export type { X as Y }` 別名)。形狀有出入的
 * (SCHEDULE / ORDERS / UPCOMING / NOTIFS_SEED 的 tone 相關欄位 member 端是嚴格
 * `Tone` 型別、mobile 端是寬鬆 `string`)，這裡存寬鬆的結構型別，形狀有出入的
 * 一側保留自己原本的 interface 宣告、只從這裡匯入值並自行斷言回自己的型別。
 * `Tone` 型別本身不進這裡;查表/成對常數以寬鬆結構型別在此宣告,窄側 facade 以自身型別對同一參照純註記收窄(NOTIFS_SEED 前例)。
 *
 * Task 1(C2 死種子退役):CATALOG/MAKEUP_SLOTS/REWARDS/REPORTS/CERTS 五組(值+
 * interface)、以及 MY_COURSES/SCHEDULE/ORDERS 三組的值,經確認無 runtime 消費者
 * (member/mobile 兩側頁面皆已改走真後端 API)後整批退役;MY_COURSES/SCHEDULE/
 * ORDERS 的 interface(EnrolledCourse/ScheduleBlock/Order)因仍供 api.ts 型別標註
 * 使用而保留。既有測試改為檔內 inline fixture,不再從這裡 import 死值。 */

import type { IconName } from '$lib/icon-registry';

/* ---- 會員 ---- */
export interface Member {
	name: string;
	initial: string;
	color: string;
	id: string;
	since: string;
	points: number;
	age: number;
}

/* Logged-in member — 王承恩 (ties to admin GY2024001) */
export const ME: Member = {
	name: '王承恩',
	initial: '王',
	color: '#0066CC',
	id: 'GY2024001',
	since: '2023/09',
	points: 1250,
	age: 13
};

/* ---- 總覽統計 ---- */
export interface Stat {
	icon: IconName;
	label: string;
	value: string;
	tint: string;
	color: string;
}

/* Member stats (總覽) */
export const STATS: Stat[] = [
	{ icon: 'book-open', label: '報名課程數', value: '3', tint: 'var(--df-primary-bg)', color: 'var(--df-primary)' },
	{ icon: 'calendar-check', label: '本月出席率', value: '95%', tint: 'var(--df-success-bg)', color: 'var(--df-success)' },
	{ icon: 'star', label: '會員點數', value: '1,250', tint: 'var(--df-info-bg)', color: 'var(--df-info)' }
];

/** [skill name, mastery 0–100] */
export type Skill = [string, number];

/* Skill mastery (from coach assessment) */
export const SKILLS: Skill[] = [
	['前滾翻', 95],
	['後手翻', 88],
	['側翻', 92],
	['團隊托舉', 74]
];

/* ---- 即將到來的課程 ----
 * status 的 tone 兩側型別不同:member 用 Tone union、mobile 用寬鬆 string(mobile
 * 的 Tone 型別本身就是 [string,string] tuple)。這裡存寬鬆版，member facade 匯入
 * 後斷言回自己的 UpcomingClass(status: [Tone, string])。 */
export interface UpcomingClass {
	name: string;
	time: string;
	venue: string;
	coach: string;
	status: [string, string];
}

/* Upcoming classes (member's booked sessions) */
export const UPCOMING: UpcomingClass[] = [
	{ name: '競技啦啦隊 進階班', time: '明日 19:00 – 20:30', venue: 'A 訓練館', coach: '林雅婷', status: ['success', '可報到'] },
	{ name: '競技體操 選手班', time: '週四 17:00 – 19:00', venue: 'A 訓練館', coach: '林雅婷', status: ['info', '已預約'] },
	{ name: '兒童翻滾 技巧班', time: '週五 18:00 – 19:00', venue: 'B 教室', coach: '陳冠宇', status: ['info', '已預約'] }
];

/* ---- 已報名課程(member 稱 EnrolledCourse、mobile 稱 MyCourse，同形) ---- */
export interface EnrolledCourse {
	id: string;
	name: string;
	cat: string;
	level: string;
	coach: string;
	icon: IconName;
	color: string;
	schedule: string;
	room: string;
	att: number;
	attended: number;
	total: number;
	next: string;
	term: string;
	remain: number;
	/** 課程 uuid（區別於 `id`——member/api.ts 的 getMine() 把 `id` 設為「報名」uuid，
	 *  非課程 uuid）。Task 11（請假/補課 UI）新增：請假入口需要課程 id 才能呼叫
	 *  GET /courses/{id}/sessions。選填——mock 資料（MY_COURSES，member/mobile 共用）
	 *  與 mobile 側目前皆未提供真正課程 id，只有桌面 member/api.ts 的 getMine() 會
	 *  填入真值；非本次範圍的既有呼叫端不受影響。 */
	course_id?: string;
}

/* ---- 出席紀錄(兩側同名同形) ----
 * Task F7：ATT_HISTORY mock 已退役——member/mobile 逐堂出勤明細改走真後端
 * GET /enrolments/{id}/attendance(integration-contract.md §3.12，見
 * member/api.ts 的 getEnrolmentAttendance())。state 隨後端 attendance_status
 * enum 收斂移除 'late'(後端只有 present/absent/leave 三值)。 */
export interface AttRecord {
	date: string;
	state: 'present' | 'leave' | 'absent';
}

/* ---- 每週課表 ----
 * tone 兩側型別不同:member 用 Tone union、mobile 用寬鬆 string。這裡存寬鬆版，
 * member facade 匯入後斷言回自己的 ScheduleBlock(tone: Tone)。 */
export interface ScheduleBlock {
	day: number; // 1=Mon … 7=Sun
	start: string;
	end: string;
	name: string;
	room: string;
	coach: string;
	color: string;
	tone: string;
}

/* ---- 每週課表格線(WEEK 星期列、TIME_ROWS 時段列;兩側逐位元組相等) ---- */
export const WEEK: string[] = ['一', '二', '三', '四', '五', '六', '日'];
export const TIME_ROWS: string[] = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

/* ---- 訂單歷史 ---- status 的 tone 兩側型別不同，處理同 SCHEDULE。 */
export interface Order {
	id: string;
	item: string;
	amount: number;
	status: [string, string];
	date: string;
}

/* ---- 教練訊息(member 稱 ChatMessage、mobile 稱 ThreadMsg，同形) ---- */
export interface ChatMessage {
	from: 'coach' | 'me';
	text: string;
	time: string;
}

/* Coach message thread (聯絡教練 / 訊息) */
export const CONTACT_THREAD: ChatMessage[] = [
	{ from: 'coach', text: '承恩這週的後手翻進步很多，下週我們來加上連續動作！', time: '昨天 18:20' },
	{ from: 'me', text: '好的教練，謝謝！週四他會準時到。', time: '昨天 20:05' }
];

/* Canned coach replies for the contact thread(聯絡教練 / 訊息 — 罐頭回覆;兩側逐位元組相等) */
export const COACH_REPLIES: string[] = [
	'收到！我會留意，謝謝家長。',
	'好的，我們課堂上再幫承恩加強。',
	'沒問題，有任何狀況都歡迎隨時跟我說 🙂',
	'了解～這部分我會特別注意。'
];

/* ---- 通知中心 ----
 * tone 兩側型別不同，處理同 SCHEDULE。cat 兩側是同一組四個字面值的 union(僅宣告
 * 順序不同)，結構相同，直接內縮不另外具名匯出。 */
export interface Notification {
	id: string;
	cat: 'class' | 'order' | 'coach' | 'system';
	icon: IconName;
	tone: string;
	title: string;
	body: string;
	time: string;
	read: boolean;
}

/* Notification center (通知中心)
 * T12 codex 終審連帶:改 satisfies 宣告(原 `: Notification[]` 註記會把 tone 字面
 * 抹寬成 string,member facade 只能靠整陣列 `as` 斷言收窄——不驗字面)。satisfies
 * 目標的 tone 聯集是本 seed 實際用到的值(值衍生、零 import;Tone 型別本身依檔頭
 * 決策仍不進 domain),tone/icon 字面自此在本宣告處逐一實檢,member facade 得以
 * 用純型別註記(零斷言)收窄同一個參照。新增列若用到新 tone,把它補進聯集即可。 */
export const NOTIFS_SEED = [
	{ id: 'n1', cat: 'class', icon: 'calendar-clock', tone: 'primary', title: '明日課程提醒', body: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館，記得提前 10 分鐘到館熱身。', time: '1 小時前', read: false },
	{ id: 'n2', cat: 'coach', icon: 'message-circle', tone: 'info', title: '林雅婷 教練回覆了你的訊息', body: '承恩這週的後手翻進步很多，下週我們來加上連續動作。', time: '3 小時前', read: false },
	{ id: 'n3', cat: 'order', icon: 'credit-card', tone: 'success', title: '報名付款成功', body: '訂單 DF-24061 · 競技啦啦隊 進階班 · 2026 春季 NT$4,800 已完成付款。', time: '昨天', read: false },
	{ id: 'n4', cat: 'class', icon: 'rotate-cw', tone: 'info', title: '補課時段已開放', body: '5/21 請假的「競技體操 選手班」可於 6/13 10:00 補課，請於我的課程預約。', time: '2 天前', read: true },
	{ id: 'n5', cat: 'system', icon: 'award', tone: 'accent', title: '獲得會員點數 +120', body: '完課獎勵點數已入帳，目前可用點數 1,250 點。', time: '3 天前', read: true },
	{ id: 'n6', cat: 'system', icon: 'calendar-off', tone: 'warning', title: '端午連假停課公告', body: '6/14–6/16 全館停課，相關課程將安排補課，請留意通知。', time: '5 天前', read: true }
] satisfies (Notification & { tone: 'primary' | 'info' | 'success' | 'warning' | 'accent' })[];

/* 通知分類 tab(all/class/order/coach/system;兩側逐位元組相等) */
export const NOTIF_CATS: [string, string][] = [
	['all', '全部'],
	['class', '課程'],
	['order', '訂單'],
	['coach', '教練'],
	['system', '系統']
];

/* ---- 點數明細(member 稱 LedgerEntry、mobile 稱 PointsEntry，同形;LedgerType
 * 兩側是同一組三個字面值，member 額外具名匯出這個型別) ---- */
export type LedgerType = 'earn' | 'redeem' | 'expire';
export interface LedgerEntry {
	id: string;
	date: string;
	desc: string;
	type: LedgerType;
	delta: number;
}

/* Member points (點數明細與兌換) */
export const POINTS_LEDGER: LedgerEntry[] = [
	{ id: 'pl1', date: '2026/06/05', desc: '完課獎勵 · 競技啦啦隊 進階班', type: 'earn', delta: 120 },
	{ id: 'pl2', date: '2026/05/20', desc: '折抵報名費 · 競技體操 選手班', type: 'redeem', delta: -300 },
	{ id: 'pl3', date: '2026/05/01', desc: '生日禮金點數', type: 'earn', delta: 200 },
	{ id: 'pl4', date: '2026/04/12', desc: '推薦好友報名獎勵', type: 'earn', delta: 150 },
	{ id: 'pl5', date: '2026/03/01', desc: '完課獎勵 · 兒童翻滾 技巧班', type: 'earn', delta: 120 },
	{ id: 'pl6', date: '2026/02/15', desc: '未使用點數到期', type: 'expire', delta: -50 }
];

