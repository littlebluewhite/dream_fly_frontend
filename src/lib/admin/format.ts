/* Dream Fly — 管理後台 · formatting helpers */

/** NT$ with thousands separators, e.g. fmtNT(4800) → "NT$4,800". */
export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** 0–1 比例 → 整數百分比字串，例如 fmtPct(0.75) → "75%"；null(見 integration-contract.md
 *  §3.24 裁決 4：分母為 0 時的防禦性 null)顯示「—」。 */
export const fmtPct = (ratio: number | null): string => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);
