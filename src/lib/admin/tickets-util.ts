/* Dream Fly — 管理後台 · 票券管理 helpers (reports.jsx TicketsView). */

/** Sold-vs-quota as a whole percent, e.g. soldPct(128, 200) → 64.
 *  Guards a zero quota (the prototype never has one, but division must not NaN). */
export const soldPct = (sold: number, quota: number): number =>
	quota > 0 ? Math.round((sold / quota) * 100) : 0;

/** ProgressBar tone for a sold percentage — warning once ≥80% of quota is gone. */
export const ticketTone = (pct: number): 'primary' | 'warning' =>
	pct >= 80 ? 'warning' : 'primary';
