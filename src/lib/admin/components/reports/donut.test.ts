import { describe, it, expect } from 'vitest';
import { donutStops } from './donut';

/* Pure conic-gradient stop builder. Cumulative boundaries must chain
 * (each slice starts where the previous ended) and the final boundary must
 * equal the sum of all pcts — for a full pie that is 100. */
describe('donutStops', () => {
	it('chains cumulative boundaries: [35,28,20,17] → 35,63,83,100', () => {
		const stops = donutStops([
			{ pct: 35, color: 'a' },
			{ pct: 28, color: 'b' },
			{ pct: 20, color: 'c' },
			{ pct: 17, color: 'd' }
		]);
		expect(stops).toBe('a 0% 35%, b 35% 63%, c 63% 83%, d 83% 100%');
	});

	it('final boundary equals the sum of all pcts (100 for a full pie)', () => {
		const slices = [
			{ pct: 46, color: 'x' },
			{ pct: 24, color: 'y' },
			{ pct: 16, color: 'z' },
			{ pct: 9, color: 'w' },
			{ pct: 5, color: 'v' }
		];
		const stops = donutStops(slices);
		const total = slices.reduce((s, x) => s + x.pct, 0);
		expect(total).toBe(100);
		// last stop's closing boundary is the cumulative total
		const lastBoundary = stops.split(', ').at(-1)!.trim().split(' ').at(-1);
		expect(lastBoundary).toBe('100%');
	});

	it('first slice always starts at 0%', () => {
		const stops = donutStops([
			{ pct: 22, color: 'p' },
			{ pct: 78, color: 'q' }
		]);
		expect(stops.startsWith('p 0% 22%')).toBe(true);
	});

	it('returns an empty string for no slices', () => {
		expect(donutStops([])).toBe('');
	});
});
