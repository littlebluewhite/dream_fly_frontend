import { describe, it, expect } from 'vitest';
import { fmtPct } from './format';

/* fmtNT 的測試已隨定義收斂搬到 $lib/format(見 src/lib/format.test.ts)；這裡只留
 * admin 表面自己的 fmtPct(nullLabel「—」的綁定)。 */
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
