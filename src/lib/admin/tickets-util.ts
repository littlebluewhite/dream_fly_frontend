/* Dream Fly — 管理後台 · 票券管理 helpers (reports.jsx TicketsView). */

/** Sold-vs-quota as a whole percent, e.g. soldPct(128, 200) → 64.
 *  Guards a zero quota (division must not NaN) and a null quota (= 不限/unlimited,
 *  見 ProductResponse.quota) — no percentage is meaningful against an unlimited
 *  quota, so both cases return 0. */
export const soldPct = (sold: number, quota: number | null): number =>
	quota != null && quota > 0 ? Math.round((sold / quota) * 100) : 0;

/** ProgressBar tone for a sold percentage — warning once ≥80% of quota is gone. */
export const ticketTone = (pct: number): 'primary' | 'warning' =>
	pct >= 80 ? 'warning' : 'primary';
