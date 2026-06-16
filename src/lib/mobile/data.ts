/* Dream Fly — 行動版會員 App · mock data + helpers (ported from mobile/data.jsx).
 *
 * Mock-only, no backend — typed `const` exports mirroring the prototype's data
 * verbatim (member 王承恩, ties to admin GY2024001). Screens read these; the
 * stores seed their initial state from NOTIFS_SEED / ME.points / ME profile. */

export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** Tone tuple — [semantic tone key, Traditional-Chinese label]. */
export type Tone = [string, string];

/* ---- Logged-in member ---- */
export interface Member {
	name: string;
	initial: string;
	color: string;
	id: string;
	since: string;
	points: number;
	age: number;
}
export const ME: Member = { name: '王承恩', initial: '王', color: '#0066CC', id: 'GY2024001', since: '2023/09', points: 1250, age: 13 };

/* ---- Member stats (home) ---- */
export interface Stat {
	icon: string;
	label: string;
	value: string;
	tint: string;
	color: string;
}
export const STATS: Stat[] = [
	{ icon: 'book-open', label: '報名課程數', value: '3', tint: 'var(--df-primary-bg)', color: 'var(--df-primary)' },
	{ icon: 'calendar-check', label: '本月出席率', value: '95%', tint: 'var(--df-success-bg)', color: 'var(--df-success)' },
	{ icon: 'star', label: '會員點數', value: '1,250', tint: 'var(--df-info-bg)', color: 'var(--df-info)' }
];

/** Skill mastery — [skill name, 0–100]. */
export type Skill = [string, number];
export const SKILLS: Skill[] = [['前滾翻', 95], ['後手翻', 88], ['側翻', 92], ['團隊托舉', 74]];

/* ---- Upcoming classes (home) ---- */
export interface Upcoming {
	name: string;
	time: string;
	venue: string;
	coach: string;
	status: Tone;
}
export const UPCOMING: Upcoming[] = [
	{ name: '競技啦啦隊 進階班', time: '明日 19:00 – 20:30', venue: 'A 訓練館', coach: '林雅婷', status: ['success', '可報到'] },
	{ name: '競技體操 選手班', time: '週四 17:00 – 19:00', venue: 'A 訓練館', coach: '林雅婷', status: ['info', '已預約'] },
	{ name: '兒童翻滾 技巧班', time: '週五 18:00 – 19:00', venue: 'B 教室', coach: '陳冠宇', status: ['info', '已預約'] }
];

/* ---- Enrolled courses (我的課程) ---- */
export interface MyCourse {
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
}
export const MY_COURSES: MyCourse[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', cat: '競技啦啦隊', level: '進階', coach: '林雅婷', icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', room: 'A 訓練館', att: 98, attended: 23, total: 24, next: '明日 19:00', term: '2026 春季', remain: 14 },
	{ id: 'k6', name: '競技體操 選手班', cat: '競技體操', level: '選手', coach: '林雅婷', icon: 'medal', color: '#F59E0B', schedule: '週四 17:00–19:00', room: 'A 訓練館', att: 88, attended: 21, total: 24, next: '週四 17:00', term: '2026 春季', remain: 10 },
	{ id: 'k8', name: '兒童翻滾 技巧班', cat: '兒童基礎', level: '進階', coach: '陳冠宇', icon: 'flame', color: '#10B981', schedule: '週五 18:00–19:00', room: 'B 教室', att: 92, attended: 11, total: 12, next: '週五 18:00', term: '2026 春季', remain: 6 }
];

/* ---- Attendance history (active course) ---- */
export interface AttRecord {
	date: string;
	state: 'present' | 'late' | 'leave' | 'absent';
}
export const ATT_HISTORY: AttRecord[] = [
	{ date: '06/06', state: 'present' }, { date: '06/04', state: 'present' }, { date: '05/30', state: 'late' },
	{ date: '05/28', state: 'present' }, { date: '05/23', state: 'present' }, { date: '05/21', state: 'leave' },
	{ date: '05/16', state: 'present' }, { date: '05/14', state: 'present' }
];
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
export const CATALOG: Course[] = [
	{ id: 1, name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', age: '3–5 歲', icon: 'baby', days: '週六 10:00', price: 2800, hot: false, coach: '黃詩涵', desc: '透過遊戲與軟墊活動建立平衡、協調與身體覺察，循序漸進培養孩子對體操的興趣。', spots: 2 },
	{ id: 2, name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', age: '7–9 歲', icon: 'rotate-cw', days: '週一 / 週三 17:30', price: 3200, hot: true, coach: '陳冠宇', desc: '從前滾翻、後滾翻到基礎倒立，建立扎實的體操底子，每班 6–8 人小班制。', spots: 2 },
	{ id: 3, name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', age: '10–16 歲', icon: 'sparkles', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷', desc: '適合已有翻滾基礎、想挑戰特技與團隊編排的學員。小班 12 人內、雙教練保護。', spots: 1 },
	{ id: 4, name: '成人體操 基礎班', level: '基礎', cat: '成人體操', age: '16 歲以上', icon: 'dumbbell', days: '週五 20:00', price: 3600, hot: false, coach: '王思齊', desc: '為成人設計的入門體操，著重柔軟度、核心力量與安全保護，零基礎可上。', spots: 3 },
	{ id: 5, name: '跑酷入門班', level: '入門', cat: '跑酷', age: '12 歲以上', icon: 'flame', days: '週日 15:00', price: 3400, hot: false, coach: '王思齊', desc: '在安全環境中學習翻越、落地與移動技巧，建立空間判斷與身體控制。', spots: 0 },
	{ id: 6, name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', age: '2–4 歲', icon: 'heart', days: '週日 10:00', price: 2600, hot: false, coach: '黃詩涵', desc: '家長與孩子一起參與，透過親子互動建立信任與運動習慣。', spots: 3 }
];
export const LEVEL_TONE: Record<string, string> = { 啟蒙: 'info', 入門: 'info', 基礎: 'primary', 進階: 'warning', 選手: 'accent' };

/* ---- Weekly schedule grid ---- */
export const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
export interface ScheduleBlock {
	day: number;
	start: string;
	end: string;
	name: string;
	room: string;
	coach: string;
	color: string;
	tone: string;
}
export const SCHEDULE: ScheduleBlock[] = [
	{ day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' },
	{ day: 3, start: '17:00', end: '19:00', name: '競技體操 選手班', room: 'A 訓練館', coach: '林雅婷', color: '#F59E0B', tone: 'accent' },
	{ day: 4, start: '18:00', end: '19:00', name: '兒童翻滾 技巧班', room: 'B 教室', coach: '陳冠宇', color: '#10B981', tone: 'success' },
	{ day: 5, start: '10:00', end: '12:00', name: '競技體操 選手班 (補課)', room: 'A 訓練館', coach: '林雅婷', color: '#0EA5E9', tone: 'info' }
];
export const TIME_ROWS = ['10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

/* ---- Announcements (home) ---- */
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

/* ---- Order history ---- */
export interface Order {
	id: string;
	item: string;
	amount: number;
	status: Tone;
	date: string;
}
export const ORDERS: Order[] = [
	{ id: 'DF-24061', item: '競技啦啦隊 進階班 · 2026 春季', amount: 4800, status: ['success', '已付款'], date: '2026/03/01' },
	{ id: 'DF-23980', item: '競技體操 選手班 · 2026 春季', amount: 6200, status: ['success', '已付款'], date: '2026/03/01' },
	{ id: 'DF-23955', item: '兒童翻滾 技巧班 · 2026 春季', amount: 3400, status: ['success', '已付款'], date: '2026/02/24' },
	{ id: 'DF-23710', item: '競技啦啦隊 進階班 · 2025 冬季', amount: 4800, status: ['neutral', '已完課'], date: '2025/12/01' }
];

/* ---- Upcoming sessions per enrolled course — used by the 請假 form ---- */
export const COURSE_SESSIONS: Record<string, string[]> = {
	k1: ['2026/06/11 (四) 19:00–20:30', '2026/06/16 (二) 19:00–20:30', '2026/06/18 (四) 19:00–20:30', '2026/06/23 (二) 19:00–20:30'],
	k6: ['2026/06/12 (五) 17:00–19:00', '2026/06/19 (五) 17:00–19:00', '2026/06/26 (五) 17:00–19:00'],
	k8: ['2026/06/13 (五) 18:00–19:00', '2026/06/20 (五) 18:00–19:00', '2026/06/27 (五) 18:00–19:00']
};
export const LEAVE_REASONS = ['生病 / 身體不適', '家庭因素', '學校活動', '出國 / 旅遊', '其他'];

/* ---- Makeup class slots (補課) ---- */
export interface MakeupSlot {
	id: string;
	date: string;
	time: string;
	room: string;
	coach: string;
	spots: number;
}
export const MAKEUP_SLOTS: MakeupSlot[] = [
	{ id: 'm1', date: '2026/06/13 (六)', time: '10:00–12:00', room: 'A 訓練館', coach: '林雅婷', spots: 3 },
	{ id: 'm2', date: '2026/06/15 (一)', time: '17:00–18:30', room: 'B 教室', coach: '陳冠宇', spots: 1 },
	{ id: 'm3', date: '2026/06/20 (六)', time: '10:00–12:00', room: 'A 訓練館', coach: '林雅婷', spots: 5 },
	{ id: 'm4', date: '2026/06/22 (一)', time: '17:00–18:30', room: 'B 教室', coach: '陳冠宇', spots: 0 }
];

/* ---- Coach message thread (聯絡教練 / 訊息) ---- */
export interface ThreadMsg {
	from: 'coach' | 'me';
	text: string;
	time: string;
}
export const CONTACT_THREAD: ThreadMsg[] = [
	{ from: 'coach', text: '承恩這週的後手翻進步很多，下週我們來加上連續動作！', time: '昨天 18:20' },
	{ from: 'me', text: '好的教練，謝謝！週四他會準時到。', time: '昨天 20:05' }
];
export const COACH_REPLIES = ['收到！我會留意，謝謝家長。', '好的，我們課堂上再幫承恩加強。', '沒問題，有任何狀況都歡迎隨時跟我說 🙂', '了解～這部分我會特別注意。'];

/* ---- Notification center (通知中心) ---- */
export interface NotifItem {
	id: string;
	cat: 'class' | 'coach' | 'order' | 'system';
	icon: string;
	tone: string;
	title: string;
	body: string;
	time: string;
	read: boolean;
}
export const NOTIFS_SEED: NotifItem[] = [
	{ id: 'n1', cat: 'class', icon: 'calendar-clock', tone: 'primary', title: '明日課程提醒', body: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館，記得提前 10 分鐘到館熱身。', time: '1 小時前', read: false },
	{ id: 'n2', cat: 'coach', icon: 'message-circle', tone: 'info', title: '林雅婷 教練回覆了你的訊息', body: '承恩這週的後手翻進步很多，下週我們來加上連續動作。', time: '3 小時前', read: false },
	{ id: 'n3', cat: 'order', icon: 'credit-card', tone: 'success', title: '報名付款成功', body: '訂單 DF-24061 · 競技啦啦隊 進階班 · 2026 春季 NT$4,800 已完成付款。', time: '昨天', read: false },
	{ id: 'n4', cat: 'class', icon: 'rotate-cw', tone: 'info', title: '補課時段已開放', body: '5/21 請假的「競技體操 選手班」可於 6/13 10:00 補課，請於我的課程預約。', time: '2 天前', read: true },
	{ id: 'n5', cat: 'system', icon: 'award', tone: 'accent', title: '獲得會員點數 +120', body: '完課獎勵點數已入帳，目前可用點數 1,250 點。', time: '3 天前', read: true },
	{ id: 'n6', cat: 'system', icon: 'calendar-off', tone: 'warning', title: '端午連假停課公告', body: '6/14–6/16 全館停課，相關課程將安排補課，請留意通知。', time: '5 天前', read: true }
];
export const NOTIF_CATS: Tone[] = [['all', '全部'], ['class', '課程'], ['order', '訂單'], ['coach', '教練'], ['system', '系統']];
export const NOTIF_TONE_BG: Record<string, string> = { primary: 'var(--df-primary-bg)', info: 'var(--df-info-bg)', success: 'var(--df-success-bg)', warning: 'var(--df-warning-bg)', accent: '#FFF8DB' };
export const NOTIF_TONE_FG: Record<string, string> = { primary: 'var(--df-primary)', info: 'var(--df-info)', success: 'var(--df-success)', warning: 'var(--df-warning)', accent: 'var(--df-accent-dark)' };

/* ---- Member points (點數明細與兌換) ---- */
export interface PointsEntry {
	id: string;
	date: string;
	desc: string;
	type: 'earn' | 'redeem' | 'expire';
	delta: number;
}
export const POINTS_LEDGER: PointsEntry[] = [
	{ id: 'pl1', date: '2026/06/05', desc: '完課獎勵 · 競技啦啦隊 進階班', type: 'earn', delta: 120 },
	{ id: 'pl2', date: '2026/05/20', desc: '折抵報名費 · 競技體操 選手班', type: 'redeem', delta: -300 },
	{ id: 'pl3', date: '2026/05/01', desc: '生日禮金點數', type: 'earn', delta: 200 },
	{ id: 'pl4', date: '2026/04/12', desc: '推薦好友報名獎勵', type: 'earn', delta: 150 },
	{ id: 'pl5', date: '2026/03/01', desc: '完課獎勵 · 兒童翻滾 技巧班', type: 'earn', delta: 120 },
	{ id: 'pl6', date: '2026/02/15', desc: '未使用點數到期', type: 'expire', delta: -50 }
];
export const PT_TYPE: Record<string, Tone> = { earn: ['success', '獲得'], redeem: ['primary', '折抵'], expire: ['neutral', '到期'] };

export interface Reward {
	id: string;
	name: string;
	cost: number;
	icon: string;
	desc: string;
	tag: string;
}
export const REWARDS: Reward[] = [
	{ id: 'rw1', name: '報名費折抵 NT$100', cost: 100, icon: 'ticket', desc: '下次報名課程可折抵 NT$100。', tag: '熱門' },
	{ id: 'rw2', name: '報名費折抵 NT$500', cost: 450, icon: 'ticket', desc: '450 點兌換 NT$500 折抵，最超值。', tag: '超值' },
	{ id: 'rw3', name: '夢飛運動毛巾', cost: 300, icon: 'shirt', desc: '品牌刺繡運動毛巾乙條，到館領取。', tag: '' },
	{ id: 'rw4', name: '單堂體驗課兌換券', cost: 600, icon: 'sparkles', desc: '可贈親友，體驗任一入門課程。', tag: '' }
];

/** Coupon codes (結帳優惠碼) — code → NT$ off. */
export const COUPONS: Record<string, number> = { DREAMFLY100: 100, NEWYEAR500: 500, WELCOME50: 50 };

/* ---- Term report cards & coach assessment — keyed by enrolled-course id ---- */
export interface Report {
	term: string;
	coach: string;
	grade: string;
	gradeLabel: string;
	skills: Skill[];
	attrs: Skill[];
	comment: string;
}
export const REPORTS: Record<string, Report> = {
	k1: {
		term: '2026 春季', coach: '林雅婷', grade: 'A', gradeLabel: '優異',
		skills: [['前滾翻', 95], ['後手翻', 88], ['側翻', 92], ['團隊托舉', 74], ['柔軟度', 90], ['核心穩定', 85]],
		attrs: [['出席率', 98], ['專注度', 92], ['團隊合作', 88], ['訓練紀律', 95]],
		comment: '承恩本季在後手翻與連續翻滾的穩定度上有明顯進步，落地控制更加扎實。團隊托舉部分仍需加強核心力量與隊員默契，建議下季持續練習。整體學習態度積極主動，是隊上的好榜樣。'
	}
};

export interface Cert {
	id: string;
	title: string;
	level: string;
	date: string;
	issuer: string;
	icon: string;
	color: string;
}
export const CERTS: Cert[] = [
	{ id: 'ct1', title: '競技啦啦隊 進階班 結業證書', level: '結業', date: '2025/12/20', issuer: 'Dream Fly 夢飛體操館', icon: 'award', color: '#0066CC' },
	{ id: 'ct2', title: '2025 台中市體操錦標賽 · 團體第三名', level: '賽事', date: '2025/11/08', issuer: '台中市體操委員會', icon: 'medal', color: '#F59E0B' },
	{ id: 'ct3', title: '兒童翻滾 技巧班 結業證書', level: '結業', date: '2025/06/15', issuer: 'Dream Fly 夢飛體操館', icon: 'award', color: '#10B981' }
];
