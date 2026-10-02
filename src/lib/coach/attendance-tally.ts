/* 出勤統計 — 計算每個出席狀態的人數。
 * marks: 會員 mid → 出席狀態的對應表
 * roster: 完整名冊（用來取得 mid 清單）
 * 回傳: 每個 AttDefault 狀態的人數（零初始化，缺漏的 mid 不計） */
import type { AttRow, AttDefault } from '$lib/coach/data';

export function tally(
  marks: Record<string, AttDefault>,
  roster: AttRow[]
): Record<AttDefault, number> {
  const acc: Record<AttDefault, number> = { present: 0, leave: 0, absent: 0 };
  for (const r of roster) {
    const k = marks[r.mid];
    if (k) acc[k] += 1;
  }
  return acc;
}
