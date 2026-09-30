/* Dream Fly — 課程詳情顯示查表（純函式，Task 11 R11 卡 3）。
 *
 * admin 桌面 ClassDialog 與 mobile-admin ClassSheet 的課程詳情 rows(R16 Task 2b 起 6 列) 原是各自
 * inline 一份、byte-identical 雙生（零測）；ClassDialog/ClassSheet/ClassCard/
 * mobile-admin classes 頁另有四處各自重複 enrolled>=cap 滿班判定與
 * Math.round(enrolled/cap*100) 百分比。本檔收斂為單一 domain 顯示查表，依
 * session-format.ts 先例落 domain，消費端直接 import、無需 facade（同 ADR 0009
 * 對純函式的直取精神）。 */

import type { IconName } from '$lib/icon-registry';
import { fmtNT } from '$lib/format';

/** 報名人數 / 上限 → 滿班判定 + 進度條百分比。full 沿用既有行為不變（含
 *  cap=0 → full=true，「上限 0 視為已滿」是既有語意，非本次變更範圍）；pct 修正
 *  cap<=0 時 Math.round(enrolled/cap*100) 落入非有限值（Infinity/NaN，依 enrolled
 *  是否也是 0）→ 0（唯一行為變更——非有限值餵給 ProgressBar/MiniBar 的 value 是
 *  既有 bug）。 */
export function classFill(enrolled: number, cap: number): { full: boolean; pct: number } {
  return {
    full: enrolled >= cap,
    pct: cap <= 0 ? 0 : Math.round((enrolled / cap) * 100)
  };
}

/** ClassDialog/ClassSheet 詳情列所需的欄位——ClassRow 的子集（admin/mobile-admin
 *  兩份 ClassRow 形狀相同）。 */
export interface ClassDetailSource {
  day: string;
  time: string;
  coach: string;
  age: string;
  cat: string;
  wait: number;
  price: number;
}

/** [icon, label, value] 詳情欄位列——搬自 ClassDialog.svelte 原 rows（fmtNT 格式化），
 *  供 ClassDialog/ClassSheet 共用。R16 Task 2b：教室/期別/開課日期/堂數/到課率/補課
 *  名額後端沒有，12 列 → 6 列。 */
export function classDetailRows(k: ClassDetailSource): [IconName, string, string][] {
  return [
    ['clock', '上課時段', k.day + ' · ' + k.time],
    ['user-round', '授課教練', k.coach + ' 教練'],
    ['cake', '適合年齡', k.age],
    ['layers', '課程類別', k.cat],
    ['user-plus', '候補人數', k.wait + ' 人'],
    ['circle-dollar-sign', '季費', fmtNT(k.price)]
  ];
}
