/* 會員中心 mock API 接縫。今天回傳 seed;未來把函式體換成 fetch 即可,呼叫端不變。 */
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, MY_COURSES, ATT_HISTORY, REPORTS, CERTS, SCHEDULE, ORDERS } from './data';
import type { Member, Stat, Skill, UpcomingClass, Announcement, EnrolledCourse, AttRecord, Report, Certificate, ScheduleBlock, Order } from './data';

/** 未來可在此單點加入延遲 / 失敗注入,呼叫端無感。 */
const reply = <T>(value: T): Promise<T> => Promise.resolve(value);

/** 「會員本人」單一內部來源;未來 fetch 只改此處。 */
const me = (): Member => ME;

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
    me: me(), stats: STATS, skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
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

export interface AccountProfile extends Member {
  birth: string;
  phone: string;
  email: string;
  guardian: string;
  remind: boolean;
  promo: boolean;
}

export interface AccountData {
  orders: Order[];
  profile: AccountProfile;
}

export const getAccount = (): Promise<AccountData> =>
  reply({
    orders: ORDERS,
    profile: {
      ...me(),
      birth: '2013/05/18',
      phone: '0911-222-333',
      email: 'wang.family@example.com',
      guardian: '王先生 · 0911-222-333',
      remind: true,
      promo: false
    }
  });
