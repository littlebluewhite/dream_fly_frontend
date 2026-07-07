import { describe, it, expect } from 'vitest';
import { fmtNT, fmtPct } from './format';

/* fmtNT mirrors the member helper and the admin source (data.jsx:12):
 * "NT$" + n.toLocaleString("en-US") — a "NT$" prefix with no space, and
 * thousands separators kicking in at >= 1000. The spaced "NT$ 458,200"
 * strings in the source are hardcoded display constants, not fmtNT output. */
describe('fmtNT', () => {
	it('prefixes NT$ with no space and adds a thousands separator', () => {
		expect(fmtNT(4800)).toBe('NT$4,800');
	});

	it('leaves sub-thousand amounts without a separator', () => {
		expect(fmtNT(600)).toBe('NT$600');
	});

	it('formats six-figure revenue', () => {
		expect(fmtNT(458200)).toBe('NT$458,200');
	});
});

describe('fmtPct', () => {
	it('rounds a 0–1 ratio to an integer percentage', () => {
		expect(fmtPct(0.75)).toBe('75%');
		expect(fmtPct(1)).toBe('100%');
		expect(fmtPct(0)).toBe('0%');
	});

	it('shows「—」for null (裁決 4：分母為 0 的防禦性 null)', () => {
		expect(fmtPct(null)).toBe('—');
	});
});
