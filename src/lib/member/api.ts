/* 會員中心 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, MY_COURSES, ATT_HISTORY, REPORTS, CERTS, SCHEDULE } from './data';
import type { Member, Stat, Skill, UpcomingClass, Announcement, EnrolledCourse, AttRecord, Report, Certificate, ScheduleBlock } from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 「我的報名課程」單一內部存取點;未來 fetch 只改此處。 */
const myCourses = (): EnrolledCourse[] => MY_COURSES;

export interface DashboardData {
  me: Member;
  stats: Stat[];
  skills: Skill[];
  upcoming: UpcomingClass[];
  announce: Announcement[];
  nextClass: string; // banner「下一堂課」— 進接縫(原為 markup 硬編)
  track: string;     // 技巧卡 track badge — 進接縫(原為 markup 硬編)
}

export const getDashboard = (): Promise<DashboardData> =>
  reply({
    me: ME, stats: STATS, skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
    nextClass: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館',
    track: '競技啦啦隊'
  });

export interface ReportsData {
  courses: EnrolledCourse[];
  reports: Record<string, Report>;
  certs: Certificate[];
}

export const getReports = (): Promise<ReportsData> =>
  reply({ courses: myCourses(), reports: REPORTS, certs: CERTS });

export interface ScheduleData { schedule: ScheduleBlock[]; }

export const getSchedule = (): Promise<ScheduleData> => reply({ schedule: SCHEDULE });

export interface MineData {
  courses: EnrolledCourse[];
  attendance: AttRecord[];
}

export const getMine = (): Promise<MineData> => reply({ courses: myCourses(), attendance: ATT_HISTORY });
