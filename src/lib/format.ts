/* Dream Fly — 跨表面共用 formatting helpers（lib-root 中性層,比照 cart-item 先例）。
 *
 * fmtNT 原本在 admin/format、member/format、mobile/data、mobile-admin/data 四處
 * 逐字重複——收斂為單一定義。fmtRatio 是三個百分比 formatter（admin fmtPct /
 * member fmtRate / coach 出勤率）共同的核心:0–1 比例 → 整數百分比字串;null 的
 * 顯示標籤依表面語境不同,由呼叫端以 nullLabel 決定（裁決 3/4 的字面綁定留在各
 * 表面模組,見 admin/format.ts、member/format.ts）。 */

/** NT$ with thousands separators, e.g. fmtNT(4800) → "NT$4,800". */
export const fmtNT = (n: number): string => 'NT$' + n.toLocaleString('en-US');

/** 0–1 比例 → 整數百分比字串;null → nullLabel（null 的顯示語意由呼叫端決定）。 */
export const fmtRatio = (ratio: number | null, nullLabel: string): string =>
	ratio == null ? nullLabel : `${Math.round(ratio * 100)}%`;
