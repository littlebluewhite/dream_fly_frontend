/* 會員中心 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, MY_COURSES, REPORTS, CERTS } from './data';
import type { Member, Stat, Skill, UpcomingClass, Announcement, EnrolledCourse, Report, Certificate } from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

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
  reply({ courses: MY_COURSES, reports: REPORTS, certs: CERTS });
