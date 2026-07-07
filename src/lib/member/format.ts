/* Dream Fly — 會員中心 · formatting helpers */

/** NT$ with thousands separators, e.g. fmtNT(4800) → "NT$4,800". */
export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** 出席率 0–1 比例 → 整數百分比字串；null(無出勤資料，裁決 3)顯示「尚無資料」，
 *  不是 0%（0% 會誤導成「有資料、出席率為零」）。 */
export const fmtRate = (rate: number | null): string =>
	rate == null ? '尚無資料' : `${Math.round(rate * 100)}%`;
