import { describe, it, expect } from 'vitest';
import { tally } from './attendance-tally';
import type { AttRow } from './data';

// 最小測試名冊
const ROSTER: AttRow[] = [
  { n: '01', name: '甲', initial: '甲', color: '#000', mid: 'A1', def: 'present' },
  { n: '02', name: '乙', initial: '乙', color: '#000', mid: 'A2', def: 'absent' },
  { n: '03', name: '丙', initial: '丙', color: '#000', mid: 'A3', def: 'leave' },
  { n: '04', name: '丁', initial: '丁', color: '#000', mid: 'A4', def: 'absent' },
  { n: '05', name: '戊', initial: '戊', color: '#000', mid: 'A5', def: 'present' },
];

describe('tally', () => {
  it('依 def 初始值計算各狀態人數', () => {
    const marks = Object.fromEntries(ROSTER.map(r => [r.mid, r.def]));
    expect(tally(marks, ROSTER)).toEqual({ present: 2, leave: 1, absent: 2 });
  });

  it('全部標記出席後 present = 名冊總數，其餘為 0', () => {
    const marks = Object.fromEntries(ROSTER.map(r => [r.mid, 'present' as const]));
    expect(tally(marks, ROSTER)).toEqual({ present: ROSTER.length, leave: 0, absent: 0 });
  });

  it('空名冊回傳全 0', () => {
    expect(tally({}, [])).toEqual({ present: 0, leave: 0, absent: 0 });
  });

  it('marks 中缺少某 mid 時不計入任何狀態', () => {
    const marks = { A1: 'present', A2: 'absent' } as const; // A3~A5 缺漏
    expect(tally(marks, ROSTER)).toEqual({ present: 1, leave: 0, absent: 1 });
  });
});
