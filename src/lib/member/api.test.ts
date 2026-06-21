import { describe, it, expect } from 'vitest';
import { getDashboard, getReports, getSchedule, getMine, getAccount } from './api';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, MY_COURSES, REPORTS, CERTS, SCHEDULE, ATT_HISTORY, ORDERS } from './data';

describe('member/api', () => {
  it('getDashboard 回傳整包儀表板資料(含 nextClass / track)', async () => {
    const d = await getDashboard();
    expect(d).toEqual({
      me: ME, stats: STATS, skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
      nextClass: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館',
      track: '競技啦啦隊'
    });
  });
  it('是 async 接縫(回 Promise)', () => {
    expect(getDashboard()).toBeInstanceOf(Promise);
  });

  it('getReports 回傳整包成績單資料', async () => {
    const d = await getReports();
    expect(d).toEqual({ courses: MY_COURSES, reports: REPORTS, certs: CERTS });
  });
  it('getReports 是 async 接縫(回 Promise)', () => {
    expect(getReports()).toBeInstanceOf(Promise);
  });

  it('getSchedule 回傳整包行事曆資料', async () => {
    const d = await getSchedule();
    expect(d).toEqual({ schedule: SCHEDULE });
  });
  it('getSchedule 是 async 接縫(回 Promise)', () => {
    expect(getSchedule()).toBeInstanceOf(Promise);
  });

  it('getMine 回傳整包我的課程資料', async () => {
    const d = await getMine();
    expect(d).toEqual({ courses: MY_COURSES, attendance: ATT_HISTORY });
  });
  it('getMine 是 async 接縫(回 Promise)', () => {
    expect(getMine()).toBeInstanceOf(Promise);
  });

  it('getAccount 回傳整包帳戶資料(orders + profile)', async () => {
    const d = await getAccount();
    expect(d).toEqual({
      orders: ORDERS,
      profile: {
        ...ME,
        birth: '2013/05/18',
        phone: '0911-222-333',
        email: 'wang.family@example.com',
        guardian: '王先生 · 0911-222-333',
        remind: true,
        promo: false
      }
    });
  });
  it('getAccount 是 async 接縫(回 Promise)', () => {
    expect(getAccount()).toBeInstanceOf(Promise);
  });
});
