/* Dream Fly — 教練端 Coach Portal · data + types.
 *
 * Faithfully ported from `docs/design/coach/data.jsx` (the recovered design
 * source). The prototype data is pre-materialised literals (no derivation by
 * mutation, unlike admin), so these are exported as typed `const`s directly.
 *
 * ⚠ `StudentLevel` (STUDENTS.level + LEVEL_TINT keys: 啟蒙/初階/中階/選手) is a
 *   DISTINCT vocabulary from the shared `Level` (TODAY_CLASSES.level, from
 *   $lib/domain/course-level — 啟蒙/入門/基礎/進階/選手, FE#17) — do NOT merge
 *   them. TodayClass.level used to have its own divergent `TodayLevel` type
 *   (初級/中級/啟蒙/高級/基礎，mixing two vocabularies); that's gone now that
 *   the backend's course_level enum is 5 values and all three surfaces
 *   (admin/coach/member) share one label set.
 *
 * Task 1(C2 死種子退役):本檔案現況是「活查表 + 活種子 + 型別」混合,不再是
 * mock-only。NOTIFS 是 Topbar 直接消費的活種子,TODAY_LABEL 是
 * coach/api.ts 消費的活種子(COACH 消費者見其宣告旁的漂移註記——W4 起
 * Topbar/Sidebar 已改讀 authStore,不再直接消費 COACH);CLASS_STATUS/LEVEL_TINT/SCHED_HOURS/
 * CAT_COLOR 是頁面與元件消費的活查表;其餘示範資料(TODAY_CLASSES/STUDENTS/
 * SCHED_DAYS/SCHED_COURSES/ATT_CLASS/ATT_ROSTER/ATT_TODAY_CLASSES/THREAD/
 * SHARED_FILES/CONVERSATIONS)因對應頁面已改走 getDashboard()/getToday()/getStudents()/
 * getSchedule()/getAttendance()/getThread()/getConversations() 等真後端接縫,經確認無 runtime
 * 消費者後已退役——interface 仍供頁面與 api.ts 的型別標註使用,除 SharedFile
 * (零型別消費者,隨值一併退役)外全數保留。 */
import type { Level } from '$lib/domain/course-level';
import type { IconName } from '$lib/icon-registry';

/* ──────────────── unions ──────────────── */
export type TodayStatus = 'done' | 'live' | 'soon' | 'wait';
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
	level: Level;
	cat: SchedCat;
	status: TodayStatus;
}
/** MyStudentResponse.courses 條目（§3.19，後端 97668d2 起含 enrolment_id）——
 *  enrolment_id 是該學員在該課程的 active enrolment id，寫評語 POST /report-cards
 *  以此指定「哪一堂課的成績單」（§3.22）。 */
export interface StudentCourse {
	course_id: string;
	course_name: string;
	enrolment_id: string;
}
export interface Student {
	/** users.id — 訊息中心「撰寫新對話」POST /conversations 的對方識別（Task 12）。 */
	user_id: string;
	name: string;
	initial: string;
	color: string;
	cls: string;
	/** 結構化課程清單（cls 是其 course_name 的「、」串接顯示形）——Task 13 寫評語
	 *  dialog 需要 enrolment_id，多堂課時供教練選擇。 */
	courses: StudentCourse[];
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
export interface Notif {
	icon: IconName;
	tone: string;
	bg: string;
	title: string;
	body: string;
	time: string;
	read: boolean;
	to: string;
}

/* ──────────────── the coach (李志偉 教練) ──────────────── */
// Task W4(coach/admin 桌面 shell 身分接 authStore):Topbar/Sidebar 已改讀
// $authStore.member 衍生身分槽位,COACH 值不再是這兩個元件的消費者——僅剩
// CoachAvatar 的預設 initial 與 routes/coach/page.test.ts 的 fixture 兩處消費者;
// Coach 型別仍是 coach/api.ts mapCoach() 的回傳形狀,不退役。
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

// Task 1(C2 死種子退役):TODAY_CLASSES(今日課程 5 堂示範資料)已退役——首頁/今日課程
// 頁改走 getDashboard()/getToday() 真後端接縫,這份 mock 已無 runtime 消費者。
// TodayClass interface 仍供頁面與 api.ts 的型別標註使用,保留。
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

// Task 1(C2 死種子退役):STUDENTS(我的學員 12 筆示範資料)已退役——學員頁改走
// getStudents() 真後端接縫,這份 mock 已無 runtime 消費者。Student/StudentCourse
// interface 仍供頁面與 api.ts 的型別標註使用,保留。

// Task 1(C2 死種子退役):SCHED_DAYS/SCHED_COURSES(排課管理示範資料)已退役——排課
// 管理頁改走 getSchedule() 真後端接縫,這兩份 mock 已無 runtime 消費者。SchedDay/
// SchedCourse interface 仍供 ScheduleGrid/ScheduleMonth 等元件的型別標註使用,保留。
export const SCHED_HOURS: string[] = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
export const CAT_COLOR: Record<SchedCat, { bar: string; bg: string; fg: string }> = {
	體操: { bar: 'var(--df-primary)', bg: 'var(--df-primary-bg)', fg: 'var(--df-primary-dark)' },
	啦啦隊: { bar: 'var(--df-accent-dark)', bg: '#FFF8DB', fg: '#92400E' },
	跑酷: { bar: 'var(--df-success)', bg: 'var(--df-success-bg)', fg: 'var(--df-success-strong)' }
};

// Task 1(C2 死種子退役):ATT_CLASS/ATT_ROSTER/ATT_TODAY_CLASSES(出勤記錄示範資料)
// 已退役——出勤記錄頁改走 getAttendance() 真後端接縫,這三份 mock 已無 runtime
// 消費者。AttClass/AttRow/AttClassFull interface 仍供頁面與 api.ts 的型別標註
// 使用,保留(id 是切換班級的 switch key,CoachDropdown echoes the NAME,
// the handler maps name→id)。
export interface AttClassFull extends AttClass {
	id: string;
	roster: AttRow[];
}

/* ──────────────── messages (訊息中心) ──────────────── */
// Task 1(C2 死種子退役):CONVERSATIONS(訊息中心 6 筆示範資料)已退役——首頁最新訊息
// 面板改由 getDashboard() 併入的真 getConversations() 接縫供資料,這份 mock 已無
// runtime 消費者。Conversation interface 與 SlaTone 仍供 mapConversation 與頁面的
// 型別標註使用,保留。

// Task 1(C2 死種子退役):THREAD/SHARED_FILES(訊息串示範資料,王媽媽 thread)已
// 退役——訊息中心頁改走 getThread() 真後端接縫,這兩份 mock 已無 runtime 消費者。
// ThreadMsg/ThreadAttach/ThreadFail interface 仍供頁面型別標註使用,
// 保留。

/* ──────────────── notifications (topbar bell menu) ────────────────
 * Defined in the prototype's shell.jsx; data, so it lives here. Old-style icon
 * `alert-triangle` is translated to the registry's `triangle-alert`. */
export const NOTIFS: Notif[] = [
	{ icon: 'clipboard-check', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', title: '點名提醒', body: '青少年體操中級班 上課中，尚未完成點名', time: '5 分鐘前', read: false, to: 'attendance' },
	{ icon: 'message-circle', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', title: '王媽媽（小明家長）', body: '老師您好，小明明天的課可以調整時間嗎？', time: '18 分鐘前', read: false, to: 'messages' },
	{ icon: 'triangle-alert', tone: 'var(--df-error)', bg: 'var(--df-error-bg)', title: '緊急訊息逾時', body: '黃媽媽的訊息已逾回覆時效 1.5 小時', time: '1 小時前', read: false, to: 'messages' },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', title: '評核待更新', body: '競技選手培訓班 3 位學員技能評量待更新', time: '昨天 16:05', read: true, to: 'students' }
];
