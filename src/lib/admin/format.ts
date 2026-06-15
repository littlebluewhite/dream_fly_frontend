/* Dream Fly — 管理後台 · formatting helpers */

/** NT$ with thousands separators, e.g. fmtNT(4800) → "NT$4,800". */
export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');
