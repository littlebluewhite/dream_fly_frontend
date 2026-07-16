/* Dream Fly — 管理後台 · formatting helpers */
import { fmtRatio } from '$lib/format';

/** 0–1 比例 → 整數百分比字串，例如 fmtPct(0.75) → "75%"；null(見 integration-contract.md
 *  §3.24 裁決 4：分母為 0 時的防禦性 null)顯示「—」。 */
export const fmtPct = (ratio: number | null): string => fmtRatio(ratio, '—');
