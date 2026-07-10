/* Dream Fly — 報表分析 · pure donut helper.
 * Turns a list of slices (each carrying a `pct` and `color`) into a
 * `conic-gradient` colour-stop string with CUMULATIVE boundaries — the exact
 * technique the React prototype inlines in CategoryDonut / PaymentSplit:
 *   let acc=0; SLICES.map(s => { const start=acc; acc+=s.pct; return `${color} ${start}% ${acc}%` }).join(', ')
 * Shared across every donut chart. Returns the comma-joined stop list (NOT
 * wrapped in conic-gradient()) so callers compose `conic-gradient(${stops})`. */

export interface DonutSlice {
	pct: number;
	color: string;
}

/** Cumulative conic-gradient stops, e.g.
 *  [{pct:35,…},{pct:28,…}] → "c0 0% 35%, c1 35% 63%". */
export function donutStops(slices: DonutSlice[]): string {
	let acc = 0;
	return slices
		.map((s) => {
			const start = acc;
			acc += s.pct;
			return `${s.color} ${start}% ${acc}%`;
		})
		.join(', ');
}
