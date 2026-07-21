/* Dream Fly — trial-dates.ts(TrialScreen 日期政策)單測(2026-07-22 架構深化 R7)。
 * 固定 vi.setSystemTime 基準驗證 buildTrialDays() 的日期序列、跨基準星期不變性、
 * toTrialDay()/pad2() 格式化。 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { pad2, toTrialDay, buildTrialDays } from './trial-dates';

afterEach(() => {
  vi.useRealTimers();
});

describe('buildTrialDays — 依「今日」動態產生 5 個試上日期(六/日/三節奏)', () => {
  it('①固定週一基準(2026/07/20):五日序列為下一個週六起 [0,1,4,7,8] 天偏移,d/full 皆正確', () => {
    vi.setSystemTime(new Date(2026, 6, 20, 9, 0, 0));

    const days = buildTrialDays();

    expect(days.map((d) => d.d)).toEqual(['07/25', '07/26', '07/29', '08/01', '08/02']);
    expect(days.map((d) => d.full)).toEqual([
      '2026/07/25 (六)',
      '2026/07/26 (日)',
      '2026/07/29 (三)',
      '2026/08/01 (六)',
      '2026/08/02 (日)'
    ]);
  });

  it('②今日恰為週六(2026/07/25)時首日跳下週六,不含今日本身(嚴格未來語意)', () => {
    vi.setSystemTime(new Date(2026, 6, 25, 9, 0, 0));

    const days = buildTrialDays();

    expect(days[0]).toEqual({ d: '08/01', w: '六', full: '2026/08/01 (六)' });
    expect(days.map((d) => d.d)).not.toContain('07/25');
  });

  it('③星期節奏恆為 六/日/三/六/日,與基準當天的星期幾無關(基準改為週四、跨年跨月)', () => {
    vi.setSystemTime(new Date(2025, 11, 11, 9, 0, 0));

    const days = buildTrialDays();

    expect(days.map((d) => d.w)).toEqual(['六', '日', '三', '六', '日']);
  });
});

describe('toTrialDay / pad2 — 格式化(YYYY/MM/DD (週) 與補零)', () => {
  it('④單位數月/日補零至 2 位,full 組成 YYYY/MM/DD (週)', () => {
    expect(pad2(5)).toBe('05');
    expect(pad2(12)).toBe('12');
    expect(toTrialDay(new Date(2026, 0, 5))).toEqual({ d: '01/05', w: '一', full: '2026/01/05 (一)' });
  });
});
