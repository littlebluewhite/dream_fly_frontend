/* Dream Fly — 會員中心 · formatting helpers */

/** NT$ with thousands separators, e.g. fmtNT(4800) → "NT$4,800". */
export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');
