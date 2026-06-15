import { describe, it, expect } from 'vitest';
import { tally } from './attendance-tally';
import type { AttRow } from './data';

// 最小測試名冊
const ROSTER: AttRow[] = [
  { n: '01', name: '甲', initial: '甲', color: '#000', mid: 'A1', def: 'present' },
  { n: '02', name: '乙', initial: '乙', color: '#000', mid: 'A2', def: 'late' },
  { n: '03', name: '丙', initial: '丙', color: '#000', mid: 'A3', def: 'leave' },
  { n: '04', name: '丁', initial: '丁', color: '#000', mid: 'A4', def: 'absent' },
  { n: '05', name: '戊', initial: '戊', color: '#000', mid: 'A5', def: 'present' },
];

describe('tally', () => {
  it('依 def 初始值計算各狀態人數', () => {
    const marks = Object.fromEntries(ROSTER.map(r => [r.mid, r.def]));
    const result = tally(marks, ROSTER);
    expect(result.present).toBe(2);
    expect(result.late).toBe(1);
    expect(result.leave).toBe(1);
    expect(result.absent).toBe(1);
  });

  it('全部標記出席後 present = 名冊總數', () => {
    const marks = Object.fromEntries(ROSTER.map(r => [r.mid, 'present']));
    const result = tally(marks, ROSTER);
    expect(result.present).toBe(ROSTER.length);
    expect(result.late).toBeUndefined();
    expect(result.leave).toBeUndefined();
    expect(result.absent).toBeUndefined();
  });

  it('空名冊回傳空物件', () => {
    const result = tally({}, []);
    expect(result).toEqual({});
  });

  it('marks 中缺少某 mid 時不計入任何狀態', () => {
    const marks = { A1: 'present', A2: 'late' }; // A3~A5 缺漏
    const result = tally(marks, ROSTER);
    expect(result.present).toBe(1);
    expect(result.late).toBe(1);
    // A3~A5 沒有 mark，不計入
    expect((result.leave ?? 0) + (result.absent ?? 0)).toBe(0);
  });
});
