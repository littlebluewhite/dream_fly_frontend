import { describe, it, expect } from 'vitest';
import { classFill, classDetailRows, type ClassDetailSource } from './class-detail';
import { fmtNT } from '$lib/format';

describe('classFill', () => {
  it('cap=0 時不再讓 pct 落入非有限值——full 沿用既有「上限 0 視為已滿」語意，pct 修正為 0（NaN/Infinity 釘）', () => {
    expect(classFill(3, 0)).toEqual({ full: true, pct: 0 });
  });

  it('負容量同樣視為已滿、pct 為 0（判準是 cap <= 0,不是 cap === 0——髒資料下不得回負百分比）', () => {
    expect(classFill(3, -1)).toEqual({ full: true, pct: 0 });
  });

  it('常規案例：未滿班 8/10 → pct 80%', () => {
    expect(classFill(8, 10)).toEqual({ full: false, pct: 80 });
  });

  it('常規案例：剛好滿班 10/10 → full=true、pct 100%', () => {
    expect(classFill(10, 10)).toEqual({ full: true, pct: 100 });
  });
});

describe('classDetailRows', () => {
  // 刻意讓每個欄位值互不相同（不沿用 seed k1 的 wait/makeup 皆為 0），避免欄位
  // 錯位/互換的 bug 被巧合的重複值蓋過去。
  const fixture: ClassDetailSource = {
    day: '週二 / 週四',
    time: '19:00–20:30',
    coach: '林雅婷',
    room: 'A 訓練館',
    age: '10–16 歲',
    cat: '競技啦啦隊',
    term: '2026 春季',
    startDate: '2026/03/01',
    sessions: 16,
    checkinRate: 85,
    wait: 3,
    makeup: 2,
    price: 4800
  };

  it('12 列逐鍵像素保真（含「N 堂」「N%」與 fmtNT 價格格式，逐字比對 ClassDialog 原 rows）', () => {
    expect(classDetailRows(fixture)).toEqual([
      ['clock', '上課時段', '週二 / 週四 · 19:00–20:30'],
      ['user-round', '授課教練', '林雅婷 教練'],
      ['map-pin', '教室 / 場地', 'A 訓練館'],
      ['cake', '適合年齡', '10–16 歲'],
      ['layers', '課程類別', '競技啦啦隊'],
      ['calendar-range', '本期期別', '2026 春季'],
      ['calendar-plus', '開課日期', '2026/03/01'],
      ['repeat-2', '本期堂數', '16 堂'],
      ['percent', '平均到課率', '85%'],
      ['user-plus', '候補人數', '3 人'],
      ['history', '補課名額', '2 位'],
      ['circle-dollar-sign', '季費', fmtNT(4800)]
    ]);
  });
});
