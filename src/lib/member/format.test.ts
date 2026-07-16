import { describe, it, expect } from 'vitest';
import { fmtRate } from './format';

/* fmtRate(nullLabel「尚無資料」的綁定,裁決 3)的 co-located 單元層——render 層的
 * member/reports/page.test.ts 已有同語意覆蓋(90%/null 兩線)。 */
describe('fmtRate', () => {
	it('rounds a 0–1 rate to an integer percentage', () => {
		expect(fmtRate(0.9)).toBe('90%');
	});

	it('null(無出勤資料，裁決 3)顯示「尚無資料」而非 0%', () => {
		expect(fmtRate(null)).toBe('尚無資料');
	});
});
