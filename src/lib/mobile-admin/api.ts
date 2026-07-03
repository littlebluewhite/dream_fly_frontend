/* 行動管理端 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import {
	PROFILES,
	COACHES,
	VENUES,
	TICKETS,
	COACH_TODAY,
	ROSTER,
	MEMBERS,
	SKILLS,
	TODAY,
	ACTIVITY,
	CLASSES,
	ORDERS,
	MESSAGES,
	type Profile,
	type Coach,
	type Venue,
	type Ticket,
	type TodayRow,
	type RosterEntry,
	type MemberRow,
	type Skill,
	type ActivityRow,
	type ClassRow,
	type OrderRow,
	type MessageRow
} from './data';

const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

export interface MoreData {
	profiles: Record<'admin' | 'coach', Profile>;
	coaches: Coach[];
	venues: Venue[];
	tickets: Ticket[];
}
export const getMore = (): Promise<MoreData> =>
	reply({ profiles: PROFILES, coaches: COACHES, venues: VENUES, tickets: TICKETS });

export interface MCoachHomeData {
	coachToday: TodayRow[];
	profiles: Record<'admin' | 'coach', Profile>;
}
export const getCoachHome = (): Promise<MCoachHomeData> => reply({ coachToday: COACH_TODAY, profiles: PROFILES });

export interface RosterData {
	roster: RosterEntry[];
}
export const getRoster = (): Promise<RosterData> => reply({ roster: ROSTER });

export interface MStudentsData {
	members: MemberRow[];
	skills: Record<string, Skill[]>;
}
export const getStudents = (): Promise<MStudentsData> => reply({ members: MEMBERS, skills: SKILLS });

export interface CsettingsData {
	profiles: Record<'admin' | 'coach', Profile>;
	coaches: Coach[];
}
export const getCsettings = (): Promise<CsettingsData> => reply({ profiles: PROFILES, coaches: COACHES });

/** Hero 日期與「在學學員/本週課堂/本月營收」KPI 帶原為頁面硬編字串,一併移入
 *  payload(換後端只改這一層;「出席偏低」KPI 維持由 members 動態算出,不在此列)。 */
export interface MAdminHomeData {
	profiles: Record<'admin' | 'coach', Profile>;
	members: MemberRow[];
	today: TodayRow[];
	activity: ActivityRow[];
	dateLabel: string;
	enrolledValue: string;
	enrolledDelta: string;
	classesWeekValue: string;
	classesWeekDelta: string;
	revenueMonthValue: string;
	revenueMonthDelta: string;
}
export const getAdminHome = (): Promise<MAdminHomeData> =>
	reply({
		profiles: PROFILES,
		members: MEMBERS,
		today: TODAY,
		activity: ACTIVITY,
		dateLabel: '2026 年 6 月 10 日',
		enrolledValue: '248',
		enrolledDelta: '+12',
		classesWeekValue: '64',
		classesWeekDelta: '+4',
		revenueMonthValue: 'NT$182K',
		revenueMonthDelta: '+8%'
	});

/** 集合 store 水合(clone,防共享參照被 mutation 污染)。 */
export interface OpsCollections {
	members: MemberRow[];
	classes: ClassRow[];
	coaches: Coach[];
	orders: OrderRow[];
}
export const getOpsCollections = (): Promise<OpsCollections> =>
	reply({
		members: MEMBERS.map((m) => ({ ...m })),
		classes: CLASSES.map((c) => ({ ...c })),
		coaches: COACHES.map((c) => ({ ...c })),
		orders: ORDERS.map((o) => ({ ...o }))
	});

/** 教練 · 訊息串列(獨立於 ops 集合水合 — 與 orders/classes/members/coaches 屬不同
 *  領域,coach/messages 專用;clone 防共享參照被 mutation 污染)。 */
export const getMessages = (): Promise<MessageRow[]> => reply(MESSAGES.map((m) => ({ ...m })));
