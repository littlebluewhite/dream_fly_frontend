import { describe, it, expect } from 'vitest';
import { getDashboard } from './api';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE } from './data';

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
});
