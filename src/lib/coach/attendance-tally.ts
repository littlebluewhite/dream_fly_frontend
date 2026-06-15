/* 出勤統計 — 計算每個出席狀態的人數。
 * marks: 會員 mid → 出席狀態的對應表
 * roster: 完整名冊（用來取得 mid 清單）
 * 回傳: { present: N, late: N, leave: N, absent: N } (僅含非零值以外的狀態也保留) */
import type { AttRow } from '$lib/coach/data';

export function tally(
  marks: Record<string, string>,
  roster: AttRow[]
): Record<string, number> {
  return roster.reduce<Record<string, number>>((acc, r) => {
    const k = marks[r.mid];
    if (k) acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}
