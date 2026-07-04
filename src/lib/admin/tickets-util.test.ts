import { describe, it, expect } from 'vitest';
import { soldPct, ticketTone } from './tickets-util';

/* Ticket sold/quota percentage + the ProgressBar tone cutoff, ported from
 * reports.jsx TicketsView: `pct = Math.round((t.sold / t.quota) * 100)` and
 * `tone = pct >= 80 ? "warning" : "primary"`. */
describe('soldPct', () => {
	it('rounds sold/quota to a whole percent', () => {
		expect(soldPct(128, 200)).toBe(64); // 月票
		expect(soldPct(234, 400)).toBe(59); // 比賽觀賽票 → 58.5 rounds to 59
		expect(soldPct(64, 100)).toBe(64);
	});
	it('is 0 when nothing sold', () => {
		expect(soldPct(0, 100)).toBe(0);
	});
	it('guards a zero quota (no divide-by-zero)', () => {
		expect(soldPct(5, 0)).toBe(0);
	});
	it('is 0 when quota is null (不限 — no ceiling to compute a percentage against)', () => {
		expect(soldPct(128, null)).toBe(0);
	});
});

describe('ticketTone', () => {
	it('is warning at/above 80% sold', () => {
		expect(ticketTone(80)).toBe('warning');
		expect(ticketTone(95)).toBe('warning');
	});
	it('is primary below 80% sold', () => {
		expect(ticketTone(79)).toBe('primary');
		expect(ticketTone(0)).toBe('primary');
	});
});
