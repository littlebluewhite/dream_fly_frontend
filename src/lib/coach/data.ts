/* Dream Fly — 教練端 Coach Portal · data + types.
 *
 * Faithfully ported from `docs/design/coach/data.jsx` (the recovered design
 * source). The prototype data is pre-materialised literals (no derivation by
 * mutation, unlike admin), so these are exported as typed `const`s directly.
 *
 * ⚠ Two DISTINCT level vocabularies — do NOT merge them:
 *   - `TodayLevel`  : TODAY_CLASSES.level  (初級/中級/啟蒙/高級/基礎)
 *   - `StudentLevel`: STUDENTS.level + LEVEL_TINT keys (啟蒙/初階/中階/選手)
 *
 * Mock-only, no backend. */

/* ──────────────── unions ──────────────── */
export type TodayStatus = 'done' | 'live' | 'soon' | 'wait';
export type TodayLevel = '初級' | '中級' | '啟蒙' | '高級' | '基礎';
export type StudentLevel = '啟蒙' | '初階' | '中階' | '選手';
export type SchedCat = '體操' | '啦啦隊' | '跑酷';
export type SchedVenue = '主場館' | '競技訓練館' | '副館';
export type AttDefault = 'present' | 'late' | 'leave' | 'absent';
export type SlaTone = 'warning' | 'muted' | 'error' | 'success';
export type ThreadWho = 'them' | 'me';

/* ──────────────── interfaces ──────────────── */
export interface Coach {
	name: string;
	display: string;
	full: string;
	en: string;
	initial: string;
	role: string;
	id: string;
	email: string;
	phone: string;
	gender: string;
	birth: string;
	emergency: string;
	bio: string;
	chips: string[];
	registered: string;
	lastLogin: string;
}
export interface TodayClass {
	id: string;
	start: string;
	end: string;
	name: string;
	room: string;
	count: number;
	level: TodayLevel;
	cat: SchedCat;
	status: TodayStatus;
}
export interface Student {
	name: string;
	initial: string;
	color: string;
	cls: string;
	level: StudentLevel;
	skill: string;
	pct: number;
	att: number;
}
export interface SchedDay {
	key: string;
	zh: string;
	date: string;
	today?: boolean;
}
export interface SchedCourse {
	day: string;
	start: string;
	end: string;
	name: string;
	count: number;
	cat: SchedCat;
	venue: SchedVenue;
}
export interface AttClass {
	name: string;
	time: string;
	room: string;
	coach: string;
}
export interface AttRow {
	n: string;
	name: string;
	initial: string;
	color: string;
	mid: string;
	def: AttDefault;
}
export interface Conversation {
	id: string;
	name: string;
	initial: string;
	color: string;
	kind: string;
	time: string;
	badge?: number;
	preview: string;
	urgent?: boolean;
	sla: string;
	slaTone: SlaTone;
}
export interface ThreadAttach {
	name: string;
	meta: string;
	kind: string;
}
export interface ThreadFail {
	name: string;
	meta: string;
}
export interface ThreadMsg {
	who: ThreadWho;
	text?: string;
	attach?: ThreadAttach;
	failed?: ThreadFail;
	time: string;
}
export interface SharedFile {
	name: string;
	meta: string;
	icon: string;
	tint: string;
}
export interface Notif {
	icon: string;
	tone: string;
	bg: string;
	title: string;
	body: string;
	time: string;
	unread: boolean;
	to: string;
}

/* ──────────────── the coach (李志偉 教練) ──────────────── */
export const COACH: Coach = {
	name: '李志偉',
	display: '李教練',
	full: '李志偉 教練',
	en: 'Wilson Li',
	initial: '李',
	role: '資深體操教練',
	id: 'DF-C2019-007',
	email: 'wilson.li@dreamfly.com.tw',
	phone: '0912-345-678',
	gender: '男',
	birth: '1987-03-15',
	emergency: '李夕林 (母親) / 0922-111-222',
	bio: '專注於幼兒及青少年體操教學，擁有國際裁判資格與六年以上教學經驗，擅長入門引導、基礎動作訓練、競技動作篩選。',
	chips: ['資深體操教練', '國際裁判認證', '6 年資歷'],
	registered: '2019-08-15',
	lastLogin: '今日 08:42'
};

export const TODAY_LABEL = '2026年5月30日 星期六';

/* ──────────────── today's classes (5 堂) ──────────────── */
export const TODAY_CLASSES: TodayClass[] = [
	{ id: 'tc1', start: '09:00', end: '10:00', name: '兒童體操初級班', room: '主場館 A 教室', count: 12, level: '初級', cat: '體操', status: 'done' },
	{ id: 'tc2', start: '10:30', end: '11:30', name: '青少年體操中級班', room: '主場館 B 教室', count: 8, level: '中級', cat: '體操', status: 'live' },
	{ id: 'tc3', start: '11:45', end: '12:45', name: '幼兒體操啟蒙班', room: '主場館 A 教室', count: 10, level: '啟蒙', cat: '體操', status: 'soon' },
	{ id: 'tc4', start: '14:00', end: '15:30', name: '競技體操選手班', room: '競技訓練館', count: 6, level: '高級', cat: '體操', status: 'wait' },
	{ id: 'tc5', start: '17:00', end: '18:00', name: '成人體適能班', room: '副館 C 教室', count: 15, level: '基礎', cat: '體操', status: 'wait' }
];

export const CLASS_STATUS: Record<TodayStatus, { label: string; bg: string; fg: string }> = {
	done: { label: '已結束', bg: '#F1F5F9', fg: '#475569' },
	live: { label: '上課中', bg: 'var(--df-success-bg)', fg: 'var(--df-success-strong)' },
	soon: { label: '即將開始', bg: 'var(--df-warning-bg)', fg: '#92400E' },
	wait: { label: '尚未開始', bg: 'var(--df-primary-bg)', fg: 'var(--df-primary-dark)' }
};

/* ──────────────── my students (我的學員) ──────────────── */
export const LEVEL_TINT: Record<StudentLevel, { bg: string; fg: string }> = {
	啟蒙: { bg: '#FCE7F3', fg: '#9D174D' },
	初階: { bg: 'var(--df-primary-bg)', fg: 'var(--df-primary-dark)' },
	中階: { bg: 'var(--df-warning-bg)', fg: '#92400E' },
	選手: { bg: '#EDE9FE', fg: '#5B21B6' }
};

export const STUDENTS: Student[] = [
	{ name: '王宥蓁', initial: '王', color: '#0066CC', cls: '兒童體操初階 B 班', level: '初階', skill: '前滾翻', pct: 80, att: 98 },
	{ name: '陳柏睿', initial: '陳', color: '#EC4899', cls: '兒童體操中階 A 班', level: '中階', skill: '後空翻', pct: 72, att: 95 },
	{ name: '林芷晴', initial: '林', color: '#10B981', cls: '幼兒體操初階班', level: '初階', skill: '倒立', pct: 65, att: 90 },
	{ name: '張家豪', initial: '張', color: '#8B5CF6', cls: '競技選手培訓班', level: '選手', skill: '空中轉體', pct: 88, att: 99 },
	{ name: '黃詩涵', initial: '黃', color: '#F59E0B', cls: '兒童體操中階 B 班', level: '中階', skill: '側手翻', pct: 78, att: 86 },
	{ name: '吳承翰', initial: '吳', color: '#0EA5E9', cls: '兒童體操初階 A 班', level: '初階', skill: '橋式', pct: 58, att: 72 },
	{ name: '劉若彤', initial: '劉', color: '#EF4444', cls: '競技選手培訓班', level: '選手', skill: '後空翻兩周', pct: 91, att: 97 },
	{ name: '蔡明軒', initial: '蔡', color: '#0066CC', cls: '兒童體操中階 A 班', level: '中階', skill: '前空翻', pct: 70, att: 93 },
	{ name: '鄭雅雯', initial: '鄭', color: '#14B8A6', cls: '幼兒體操初階班', level: '初階', skill: '平衡木走步', pct: 62, att: 68 },
	{ name: '許書豪', initial: '許', color: '#8B5CF6', cls: '競技選手培訓班', level: '選手', skill: '團身後空翻', pct: 85, att: 96 },
	{ name: '楊子萱', initial: '楊', color: '#EC4899', cls: '兒童體操中階 B 班', level: '中階', skill: '跳箱', pct: 75, att: 88 },
	{ name: '周冠廷', initial: '周', color: '#F59E0B', cls: '兒童體操初階 B 班', level: '初階', skill: '蹲撐', pct: 68, att: 91 }
];

/* ──────────────── weekly schedule (排課管理) ──────────────── */
export const SCHED_DAYS: SchedDay[] = [
	{ key: 'Mon', zh: '一', date: '5/25' },
	{ key: 'Tue', zh: '二', date: '5/26' },
	{ key: 'Wed', zh: '三', date: '5/27' },
	{ key: 'Thu', zh: '四', date: '5/28' },
	{ key: 'Fri', zh: '五', date: '5/29' },
	{ key: 'Sat', zh: '六', date: '5/30', today: true },
	{ key: 'Sun', zh: '日', date: '5/31' }
];
export const SCHED_HOURS: string[] = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
export const SCHED_COURSES: SchedCourse[] = [
	{ day: 'Mon', start: '09:00', end: '10:00', name: '幼兒體操初階', count: 8, cat: '體操', venue: '主場館' },
	{ day: 'Mon', start: '15:00', end: '16:30', name: '青少年競技組', count: 12, cat: '體操', venue: '競技訓練館' },
	{ day: 'Tue', start: '10:00', end: '11:00', name: '啦啦隊基礎', count: 10, cat: '啦啦隊', venue: '主場館' },
	{ day: 'Wed', start: '09:00', end: '10:30', name: '成人體操', count: 6, cat: '體操', venue: '副館' },
	{ day: 'Wed', start: '16:00', end: '17:00', name: '跑酷入門', count: 8, cat: '跑酷', venue: '副館' },
	{ day: 'Thu', start: '14:00', end: '15:00', name: '幼兒體操進階', count: 10, cat: '體操', venue: '主場館' },
	{ day: 'Fri', start: '10:00', end: '11:30', name: '競技啦啦隊', count: 14, cat: '啦啦隊', venue: '競技訓練館' },
	{ day: 'Fri', start: '17:00', end: '18:00', name: '跑酷進階', count: 6, cat: '跑酷', venue: '副館' },
	{ day: 'Sat', start: '09:00', end: '10:00', name: '週末親子班', count: 12, cat: '體操', venue: '主場館' },
	{ day: 'Sat', start: '11:00', end: '12:00', name: '幼兒體操初階', count: 8, cat: '體操', venue: '主場館' }
];
export const CAT_COLOR: Record<SchedCat, { bar: string; bg: string; fg: string }> = {
	體操: { bar: 'var(--df-primary)', bg: 'var(--df-primary-bg)', fg: 'var(--df-primary-dark)' },
	啦啦隊: { bar: 'var(--df-accent-dark)', bg: '#FFF8DB', fg: '#92400E' },
	跑酷: { bar: 'var(--df-success)', bg: 'var(--df-success-bg)', fg: 'var(--df-success-strong)' }
};

/* ──────────────── attendance roster (出勤記錄 · 兒童體操初階班) ──────────────── */
export const ATT_CLASS: AttClass = { name: '兒童體操初階班', time: '今日 16:00–17:30', room: 'A 教室', coach: '陳怡君' };
export const ATT_ROSTER: AttRow[] = [
	{ n: '01', name: '王承恩', initial: '王', color: '#0066CC', mid: 'GY2024001', def: 'present' },
	{ n: '02', name: '林佳穎', initial: '林', color: '#EC4899', mid: 'GY2024014', def: 'late' },
	{ n: '03', name: '陳冠廷', initial: '陳', color: '#10B981', mid: 'GY2024022', def: 'present' },
	{ n: '04', name: '張雅婷', initial: '張', color: '#8B5CF6', mid: 'GY2024030', def: 'leave' },
	{ n: '05', name: '李宗翰', initial: '李', color: '#F59E0B', mid: 'GY2024041', def: 'present' },
	{ n: '06', name: '黃詩涵', initial: '黃', color: '#0EA5E9', mid: 'GY2024055', def: 'present' },
	{ n: '07', name: '吳柏宇', initial: '吳', color: '#EF4444', mid: 'GY2024063', def: 'absent' },
	{ n: '08', name: '劉芷瑄', initial: '劉', color: '#14B8A6', mid: 'GY2024074', def: 'present' },
	{ n: '09', name: '蔡承勳', initial: '蔡', color: '#0066CC', mid: 'GY2024088', def: 'present' },
	{ n: '10', name: '鄭于晴', initial: '鄭', color: '#EC4899', mid: 'GY2024092', def: 'present' },
	{ n: '11', name: '許家豪', initial: '許', color: '#8B5CF6', mid: 'GY2024101', def: 'present' }
];

/* ──────────────── today's classes to take attendance for (切換班級) ────────────────
 * A1 of the attendance roster is the FIRST class — it reuses ATT_CLASS + ATT_ROSTER
 * verbatim so 出勤記錄 opens on the same roster as before. The other classes carry
 * their own small rosters. `id` is the switch key (CoachDropdown echoes the NAME,
 * the handler maps name→id). */
export interface AttClassFull extends AttClass {
	id: string;
	roster: AttRow[];
}
export const ATT_TODAY_CLASSES: AttClassFull[] = [
	{ id: 'ac1', ...ATT_CLASS, roster: ATT_ROSTER },
	{
		id: 'ac2',
		name: '青少年體操中級班',
		time: '今日 13:30–15:00',
		room: 'B 教室',
		coach: '陳怡君',
		roster: [
			{ n: '01', name: '周彥廷', initial: '周', color: '#0066CC', mid: 'GY2023012', def: 'present' },
			{ n: '02', name: '簡子涵', initial: '簡', color: '#EC4899', mid: 'GY2023027', def: 'present' },
			{ n: '03', name: '潘宥廷', initial: '潘', color: '#10B981', mid: 'GY2023039', def: 'late' },
			{ n: '04', name: '蕭詠晴', initial: '蕭', color: '#8B5CF6', mid: 'GY2023044', def: 'present' },
			{ n: '05', name: '范書瑋', initial: '范', color: '#F59E0B', mid: 'GY2023051', def: 'leave' },
			{ n: '06', name: '葉承恩', initial: '葉', color: '#0EA5E9', mid: 'GY2023068', def: 'present' }
		]
	},
	{
		id: 'ac3',
		name: '競技體操選手班',
		time: '今日 16:00–18:00',
		room: '競技訓練館',
		coach: '李志偉',
		roster: [
			{ n: '01', name: '張家豪', initial: '張', color: '#8B5CF6', mid: 'GY2022003', def: 'present' },
			{ n: '02', name: '劉若彤', initial: '劉', color: '#EF4444', mid: 'GY2022011', def: 'present' },
			{ n: '03', name: '許書豪', initial: '許', color: '#14B8A6', mid: 'GY2022018', def: 'present' },
			{ n: '04', name: '鍾佩珊', initial: '鍾', color: '#0066CC', mid: 'GY2022025', def: 'late' }
		]
	}
];

/* ──────────────── messages (訊息中心) ──────────────── */
export const CONVERSATIONS: Conversation[] = [
	{ id: 'v1', name: '王媽媽', initial: '王', color: '#0066CC', kind: '家長', time: '09:42', badge: 2, preview: '老師您好，小明明天的課可以調整時間嗎？', urgent: true, sla: '30 分內需回覆', slaTone: 'warning' },
	{ id: 'v2', name: '競技選手班 群組', initial: '群', color: '#8B5CF6', kind: '群組', time: '09:20', badge: 5, preview: '請問週六加課的場地確定了嗎？', sla: '今日內回覆', slaTone: 'muted' },
	{ id: 'v3', name: '林同學', initial: '林', color: '#10B981', kind: '學員', time: '08:55', badge: 1, preview: '教練我這週想請假，需要補課嗎？', sla: '2 小時內回覆', slaTone: 'muted' },
	{ id: 'v4', name: '黃媽媽', initial: '黃', color: '#F59E0B', kind: '家長', time: '昨天', preview: '孩子在課堂上跌倒，想了解處理狀況…', urgent: true, sla: '已逾時 1.5h', slaTone: 'error' },
	{ id: 'v5', name: '陳爸爸', initial: '陳', color: '#EC4899', kind: '家長', time: '昨天', preview: '謝謝老師這學期的細心指導！', sla: '已回覆', slaTone: 'success' },
	{ id: 'v6', name: '吳媽媽', initial: '吳', color: '#0EA5E9', kind: '家長', time: '週一', preview: '收到，謝謝您。', sla: '已回覆', slaTone: 'success' }
];

/* ──────────────── compose recipient directory (撰寫 新訊息) ────────────────
 * Contacts the coach can start a NEW conversation with. Deliberately disjoint
 * from CONVERSATIONS (those threads already exist). */
export interface MsgRecipient {
	name: string;
	initial: string;
	color: string;
	kind: string;
}
export const MSG_DIRECTORY: MsgRecipient[] = [
	{ name: '張媽媽', initial: '張', color: '#8B5CF6', kind: '家長' },
	{ name: '劉同學', initial: '劉', color: '#EF4444', kind: '學員' },
	{ name: '蔡爸爸', initial: '蔡', color: '#0066CC', kind: '家長' },
	{ name: '幼兒體操班 群組', initial: '群', color: '#10B981', kind: '群組' },
	{ name: '鄭媽媽', initial: '鄭', color: '#14B8A6', kind: '家長' },
	{ name: '楊同學', initial: '楊', color: '#EC4899', kind: '學員' }
];

/* thread for 王媽媽 — me = 李教練 (right aligned) */
export const THREAD: ThreadMsg[] = [
	{ who: 'them', text: '教練好！想請問小明最近的狀況 😊', time: '09:10' },
	{ who: 'me', text: '王媽媽好！小明這週進步很多 👍', time: '09:15' },
	{ who: 'me', text: '後滾翻已經很穩定，平衡木也更有自信了', time: '09:15' },
	{ who: 'me', attach: { name: '小明_平衡木練習.mp4', meta: '影片 · 12.4 MB', kind: 'video' }, time: '09:16' },
	{ who: 'them', text: '太好了！謝謝教練這麼用心 🙏', time: '09:20' },
	{ who: 'them', text: '好的，謝謝教練！下週見 😊', time: '09:24' },
	{ who: 'me', failed: { name: '示範動作_平衡木.mp4', meta: '18.4 MB' }, time: '09:18 · 未送出' }
];

export const SHARED_FILES: SharedFile[] = [
	{ name: '小明_平衡木練習.mp4', meta: '影片 · 12.4 MB', icon: 'circle-play', tint: 'var(--df-primary)' },
	{ name: '比賽報名表.jpg', meta: '圖片 · 2.1 MB', icon: 'image', tint: 'var(--df-success)' }
];

/* ──────────────── notifications (topbar bell menu) ────────────────
 * Defined in the prototype's shell.jsx; data, so it lives here. Old-style icon
 * `alert-triangle` is translated to the registry's `triangle-alert`. */
export const NOTIFS: Notif[] = [
	{ icon: 'clipboard-check', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '點名提醒', body: '青少年體操中級班 上課中，尚未完成點名', time: '5 分鐘前', unread: true, to: 'attendance' },
	{ icon: 'message-circle', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '王媽媽（小明家長）', body: '老師您好，小明明天的課可以調整時間嗎？', time: '18 分鐘前', unread: true, to: 'messages' },
	{ icon: 'triangle-alert', tone: 'var(--df-error)', bg: 'var(--df-error-bg)', title: '緊急訊息逾時', body: '黃媽媽的訊息已逾回覆時效 1.5 小時', time: '1 小時前', unread: true, to: 'messages' },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', title: '評核待更新', body: '競技選手培訓班 3 位學員技能評量待更新', time: '昨天 16:05', unread: false, to: 'students' }
];
