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
	type Profile,
	type Coach,
	type Venue,
	type Ticket,
	type TodayRow,
	type RosterEntry,
	type MemberRow,
	type Skill,
	type ActivityRow
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

export interface MAdminHomeData {
	profiles: Record<'admin' | 'coach', Profile>;
	members: MemberRow[];
	today: TodayRow[];
	activity: ActivityRow[];
}
export const getAdminHome = (): Promise<MAdminHomeData> =>
	reply({ profiles: PROFILES, members: MEMBERS, today: TODAY, activity: ACTIVITY });
