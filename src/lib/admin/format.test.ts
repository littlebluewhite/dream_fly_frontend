import { describe, it, expect } from 'vitest';
import { fmtNT } from './format';

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
