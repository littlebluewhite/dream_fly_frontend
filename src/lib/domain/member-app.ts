/* src/lib/domain/member-app.ts — 會員 app(member 桌面 / mobile 手機雙生)共用 seed 單一來源。
 * 值逐位元組沿用 member 側；僅收值相等的常數，查表與型別留在各 facade。
 *
 * member 與 mobile 是同一個「會員 app」的桌面/手機雙生，data.ts 近乎重複(同 persona
 * 王承恩 GY2024001)。這裡只收兩側 JSON.stringify 深度相等的常數 —— ANNOUNCE 有一筆
 * 公告的 bg 色兩側不同(member 'var(--df-accent-bg)' vs mobile '#FFF8DB')，因此整個
 * ANNOUNCE 留在原地(member/data.ts、mobile/data.ts 各自的字面陣列)，不搬進這裡。
 *
 * 型別策略:形狀完全相同(同名或僅名稱不同)的 interface 直接上移，兩側 facade
 * pass-through(名稱不同時用 `export type { X as Y }` 別名)。形狀有出入的
 * (CATALOG 的 mobile 端多一個 index signature；SCHEDULE / ORDERS / UPCOMING /
 * NOTIFS_SEED 的 tone 相關欄位 member 端是嚴格 `Tone` 型別、mobile 端是寬鬆
 * `string`)，這裡存寬鬆的結構型別，形狀有出入的一側保留自己原本的 interface
 * 宣告、只從這裡匯入值並自行斷言回自己的型別。`Tone`(member 側是 union、mobile
 * 側是 tuple，兩者不相容)一律不進這裡。 */

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
	icon: string;
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
	icon: string;
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

/* Enrolled courses (我的課程) */
export const MY_COURSES: EnrolledCourse[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', cat: '競技啦啦隊', level: '進階', coach: '林雅婷', icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', room: 'A 訓練館', att: 98, attended: 23, total: 24, next: '明日 19:00', term: '2026 春季', remain: 14 },
	{ id: 'k6', name: '競技體操 選手班', cat: '競技體操', level: '選手', coach: '林雅婷', icon: 'medal', color: '#F59E0B', schedule: '週四 17:00–19:00', room: 'A 訓練館', att: 88, attended: 21, total: 24, next: '週四 17:00', term: '2026 春季', remain: 10 },
	{ id: 'k8', name: '兒童翻滾 技巧班', cat: '兒童基礎', level: '進階', coach: '陳冠宇', icon: 'flame', color: '#10B981', schedule: '週五 18:00–19:00', room: 'B 教室', att: 92, attended: 11, total: 12, next: '週五 18:00', term: '2026 春季', remain: 6 }
];

/* ---- 出席紀錄(兩側同名同形) ----
 * Task F7：ATT_HISTORY mock 已退役——member/mobile 逐堂出勤明細改走真後端
 * GET /enrolments/{id}/attendance(integration-contract.md §3.12，見
 * member/api.ts 的 getEnrolmentAttendance())。state 隨後端 attendance_status
 * enum 收斂移除 'late'(後端只有 present/absent/leave 三值)。 */
export interface AttRecord {
	date: string;
	state: 'present' | 'leave' | 'absent';
}

/* ---- 課程介紹 ----
 * mobile 的 Course 多一個 `[k: string]: unknown` index signature(供購物車
 * CartInput 用)，member 的 CatalogCourse 沒有 —— 形狀有出入，這裡存 member 的窄
 * 版，mobile facade 保留自己原本的 Course interface、只換值來源。 */
export interface CatalogCourse {
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
}

/* Course catalog (課程介紹) */
export const CATALOG: CatalogCourse[] = [
	{ id: 1, name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', age: '3–5 歲', icon: 'baby', days: '週六 10:00', price: 2800, hot: false, coach: '黃詩涵', desc: '透過遊戲與軟墊活動建立平衡、協調與身體覺察，循序漸進培養孩子對體操的興趣。', spots: 2 },
	{ id: 2, name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', age: '7–9 歲', icon: 'rotate-cw', days: '週一 / 週三 17:30', price: 3200, hot: true, coach: '陳冠宇', desc: '從前滾翻、後滾翻到基礎倒立，建立扎實的體操底子，每班 6–8 人小班制。', spots: 2 },
	{ id: 3, name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', icon: 'sparkles', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。小班 12 人內、雙教練保護。', spots: 1 },
	{ id: 4, name: '成人體操 基礎班', level: '基礎', cat: '成人體操', age: '16 歲以上', icon: 'dumbbell', days: '週五 20:00', price: 3600, hot: false, coach: '王思齊', desc: '為成人設計的入門體操，著重柔軟度、核心力量與安全保護，零基礎可上。', spots: 3 },
	{ id: 5, name: '跑酷入門班', level: '入門', cat: '跑酷', age: '12 歲以上', icon: 'flame', days: '週日 15:00', price: 3400, hot: false, coach: '王思齊', desc: '在安全環境中學習翻越、落地與移動技巧，建立空間判斷與身體控制。', spots: 0 },
	{ id: 6, name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', age: '2–4 歲', icon: 'heart', days: '週日 10:00', price: 2600, hot: false, coach: '黃詩涵', desc: '家長與孩子一起參與，透過親子互動建立信任與運動習慣。', spots: 3 }
];

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

/* Weekly schedule grid (member's classes) */
export const SCHEDULE: ScheduleBlock[] = [
	{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' },
	{ day: 3, start: '17:00', end: '19:00', name: '競技體操 選手班', room: 'A 訓練館', coach: '林雅婷', color: '#F59E0B', tone: 'accent' },
	{ day: 4, start: '18:00', end: '19:00', name: '兒童翻滾 技巧班', room: 'B 教室', coach: '陳冠宇', color: '#10B981', tone: 'success' },
	{ day: 5, start: '10:00', end: '12:00', name: '競技體操 選手班 (補課)', room: 'A 訓練館', coach: '林雅婷', color: '#0EA5E9', tone: 'info' }
];

/* ---- 訂單歷史 ---- status 的 tone 兩側型別不同，處理同 SCHEDULE。 */
export interface Order {
	id: string;
	item: string;
	amount: number;
	status: [string, string];
	date: string;
}

/* Order history (帳戶) */
export const ORDERS: Order[] = [
	{ id: 'DF-24061', item: '競技啦啦隊 進階班 · 2026 春季', amount: 4800, status: ['success', '已付款'], date: '2026/03/01' },
	{ id: 'DF-23980', item: '競技體操 選手班 · 2026 春季', amount: 6200, status: ['success', '已付款'], date: '2026/03/01' },
	{ id: 'DF-23955', item: '兒童翻滾 技巧班 · 2026 春季', amount: 3400, status: ['success', '已付款'], date: '2026/02/24' },
	{ id: 'DF-23710', item: '競技啦啦隊 進階班 · 2025 冬季', amount: 4800, status: ['neutral', '已完課'], date: '2025/12/01' }
];

/* ---- 補課時段(兩側同名同形) ---- */
export interface MakeupSlot {
	id: string;
	date: string;
	time: string;
	room: string;
	coach: string;
	spots: number;
}

/* Makeup class slots (補課) */
export const MAKEUP_SLOTS: MakeupSlot[] = [
	{ id: 'm1', date: '2026/06/13 (六)', time: '10:00–12:00', room: 'A 訓練館', coach: '林雅婷', spots: 3 },
	{ id: 'm2', date: '2026/06/15 (一)', time: '17:00–18:30', room: 'B 教室', coach: '陳冠宇', spots: 1 },
	{ id: 'm3', date: '2026/06/20 (六)', time: '10:00–12:00', room: 'A 訓練館', coach: '林雅婷', spots: 5 },
	{ id: 'm4', date: '2026/06/22 (一)', time: '17:00–18:30', room: 'B 教室', coach: '陳冠宇', spots: 0 }
];

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

/* ---- 通知中心 ----
 * tone 兩側型別不同，處理同 SCHEDULE。cat 兩側是同一組四個字面值的 union(僅宣告
 * 順序不同)，結構相同，直接內縮不另外具名匯出。 */
export interface Notification {
	id: string;
	cat: 'class' | 'order' | 'coach' | 'system';
	icon: string;
	tone: string;
	title: string;
	body: string;
	time: string;
	read: boolean;
}

/* Notification center (通知中心) */
export const NOTIFS_SEED: Notification[] = [
	{ id: 'n1', cat: 'class', icon: 'calendar-clock', tone: 'primary', title: '明日課程提醒', body: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館，記得提前 10 分鐘到館熱身。', time: '1 小時前', read: false },
	{ id: 'n2', cat: 'coach', icon: 'message-circle', tone: 'info', title: '林雅婷 教練回覆了你的訊息', body: '承恩這週的後手翻進步很多，下週我們來加上連續動作。', time: '3 小時前', read: false },
	{ id: 'n3', cat: 'order', icon: 'credit-card', tone: 'success', title: '報名付款成功', body: '訂單 DF-24061 · 競技啦啦隊 進階班 · 2026 春季 NT$4,800 已完成付款。', time: '昨天', read: false },
	{ id: 'n4', cat: 'class', icon: 'rotate-cw', tone: 'info', title: '補課時段已開放', body: '5/21 請假的「競技體操 選手班」可於 6/13 10:00 補課，請於我的課程預約。', time: '2 天前', read: true },
	{ id: 'n5', cat: 'system', icon: 'award', tone: 'accent', title: '獲得會員點數 +120', body: '完課獎勵點數已入帳，目前可用點數 1,250 點。', time: '3 天前', read: true },
	{ id: 'n6', cat: 'system', icon: 'calendar-off', tone: 'warning', title: '端午連假停課公告', body: '6/14–6/16 全館停課，相關課程將安排補課，請留意通知。', time: '5 天前', read: true }
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

/* ---- 點數兌換項目(兩側同名同形) ---- */
export interface Reward {
	id: string;
	name: string;
	cost: number;
	icon: string;
	desc: string;
	tag: string;
}

/* Reward catalog (點數兌換) */
export const REWARDS: Reward[] = [
	{ id: 'rw1', name: '報名費折抵 NT$100', cost: 100, icon: 'ticket', desc: '下次報名課程可折抵 NT$100。', tag: '熱門' },
	{ id: 'rw2', name: '報名費折抵 NT$500', cost: 450, icon: 'ticket', desc: '450 點兌換 NT$500 折抵，最超值。', tag: '超值' },
	{ id: 'rw3', name: '夢飛運動毛巾', cost: 300, icon: 'shirt', desc: '品牌刺繡運動毛巾乙條，到館領取。', tag: '' },
	{ id: 'rw4', name: '單堂體驗課兌換券', cost: 600, icon: 'sparkles', desc: '可贈親友，體驗任一入門課程。', tag: '' }
];

/* ---- 成績單與教練評語(兩側同名同形，keyed by enrolled-course id) ---- */
export interface Report {
	term: string;
	coach: string;
	grade: string;
	gradeLabel: string;
	skills: Skill[];
	attrs: Skill[];
	comment: string;
}

/* Term report cards & coach assessment (成績單 / 教練評語) — keyed by enrolled-course id */
export const REPORTS: Record<string, Report> = {
	k1: {
		term: '2026 春季',
		coach: '林雅婷',
		grade: 'A',
		gradeLabel: '優異',
		skills: [['前滾翻', 95], ['後手翻', 88], ['側翻', 92], ['團隊托舉', 74], ['柔軟度', 90], ['核心穩定', 85]],
		attrs: [['出席率', 98], ['專注度', 92], ['團隊合作', 88], ['訓練紀律', 95]],
		comment:
			'承恩本季在後手翻與連續翻滾的穩定度上有明顯進步，落地控制更加扎實。團隊托舉部分仍需加強核心力量與隊員默契，建議下季持續練習。整體學習態度積極主動，是隊上的好榜樣。'
	}
};

/* ---- 證書(member 稱 Certificate、mobile 稱 Cert，同形) ---- */
export interface Certificate {
	id: string;
	title: string;
	level: string;
	date: string;
	issuer: string;
	icon: string;
	color: string;
}

/* Certificates (證書) */
export const CERTS: Certificate[] = [
	{ id: 'ct1', title: '競技啦啦隊 進階班 結業證書', level: '結業', date: '2025/12/20', issuer: 'Dream Fly 夢飛體操館', icon: 'award', color: '#0066CC' },
	{ id: 'ct2', title: '2025 台中市體操錦標賽 · 團體第三名', level: '賽事', date: '2025/11/08', issuer: '台中市體操委員會', icon: 'medal', color: '#F59E0B' },
	{ id: 'ct3', title: '兒童翻滾 技巧班 結業證書', level: '結業', date: '2025/06/15', issuer: 'Dream Fly 夢飛體操館', icon: 'award', color: '#10B981' }
];
