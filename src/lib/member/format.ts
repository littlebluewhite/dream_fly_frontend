/* Dream Fly — 會員中心 · formatting helpers */
import { fmtRatio } from '$lib/format';

/** 出席率 0–1 比例 → 整數百分比字串；null(無出勤資料，裁決 3)顯示「尚無資料」，
 *  不是 0%（0% 會誤導成「有資料、出席率為零」）。 */
export const fmtRate = (rate: number | null): string => fmtRatio(rate, '尚無資料');
