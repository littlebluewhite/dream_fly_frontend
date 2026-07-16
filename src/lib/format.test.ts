import { describe, it, expect } from 'vitest';
import { fmtNT, fmtRatio } from './format';

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

describe('fmtRatio', () => {
	it('rounds a 0–1 ratio to an integer percentage', () => {
		expect(fmtRatio(0.75, '—')).toBe('75%');
		expect(fmtRatio(1, '—')).toBe('100%');
		expect(fmtRatio(0, '—')).toBe('0%');
	});

	// null 的顯示標籤由呼叫端決定——admin fmtPct 綁「—」(裁決 4)、member fmtRate /
	// coach 出勤率綁「尚無資料」(裁決 3)。
	it.each(['—', '尚無資料'])('null → 呼叫端指定的 nullLabel(%s)', (nullLabel) => {
		expect(fmtRatio(null, nullLabel)).toBe(nullLabel);
	});
});
