/* 教練工作台 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import {
	COACH,
	TODAY_LABEL,
	TODAY_CLASSES,
	CONVERSATIONS,
	ATT_TODAY_CLASSES,
	SCHED_COURSES,
	STUDENTS,
	MSG_DIRECTORY,
	THREAD,
	SHARED_FILES
} from './data';
import type {
	Coach,
	TodayClass,
	Conversation,
	AttClassFull,
	SchedCourse,
	Student,
	MsgRecipient,
	ThreadMsg,
	SharedFile
} from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 「登入教練本人」與「今日課表」單一內部存取點;index 與 today 兩頁共用。 */
const me = () => COACH;
const todayClasses = () => TODAY_CLASSES;

/** 首頁 KPI 卡數字(待點名/出席率/待回覆)原為頁面硬編字串,一併移入接縫。 */
export interface CoachDashboardData {
	coach: Coach;
	todayLabel: string;
	todayClasses: TodayClass[];
	conversations: Conversation[];
	pendingClasses: string;
	attendanceRate: string;
	pendingReplies: string;
}
export const getDashboard = (): Promise<CoachDashboardData> =>
	reply({
		coach: me(),
		todayLabel: TODAY_LABEL,
		todayClasses: todayClasses(),
		conversations: CONVERSATIONS,
		pendingClasses: '2 班',
		attendanceRate: '92%',
		pendingReplies: '3 則'
	});

export interface TodayData { todayLabel: string; todayClasses: TodayClass[] }
export const getToday = (): Promise<TodayData> =>
	reply({ todayLabel: TODAY_LABEL, todayClasses: todayClasses() });

export interface AttendanceData { classes: AttClassFull[] }
export const getAttendance = (): Promise<AttendanceData> => reply({ classes: ATT_TODAY_CLASSES });

export interface CoachScheduleData { courses: SchedCourse[] }
export const getSchedule = (): Promise<CoachScheduleData> => reply({ courses: SCHED_COURSES });

export interface MessagesData {
	conversations: Conversation[];
	directory: MsgRecipient[];
	thread: ThreadMsg[];
	sharedFiles: SharedFile[];
}
export const getMessages = (): Promise<MessagesData> =>
	reply({ conversations: CONVERSATIONS, directory: MSG_DIRECTORY, thread: THREAD, sharedFiles: SHARED_FILES });

export interface StudentsData { students: Student[] }
export const getStudents = (): Promise<StudentsData> => reply({ students: STUDENTS });

export interface CoachSettingsData { coach: Coach }
export const getSettings = (): Promise<CoachSettingsData> => reply({ coach: me() });
