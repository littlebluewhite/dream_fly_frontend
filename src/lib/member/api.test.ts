import { describe, it, expect } from 'vitest';
import { getDashboard, getReports } from './api';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, MY_COURSES, REPORTS, CERTS } from './data';

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
});
