import { describe, it, expect } from 'vitest';
import { LEVELS, COURSE_LEVEL_LABEL, type Level } from './course-level';

/* 課程等級單一共用對照表（Task 18 FE#17）—— admin/coach/member 三 surface 共
 * import，取代各自分歧的舊 label map。 */
describe('course-level — 共用 5 級對照常數', () => {
	it('LEVELS 依序涵蓋 5 級', () => {
		expect(LEVELS).toEqual(['啟蒙', '入門', '基礎', '進階', '選手']);
	});

	it('COURSE_LEVEL_LABEL 涵蓋後端全部 5 個 course_level 值', () => {
		expect(COURSE_LEVEL_LABEL).toEqual({
			foundation: '啟蒙',
			beginner: '入門',
			intermediate: '基礎',
			advanced: '進階',
			elite: '選手'
		});
	});

	it('每個對照值都是合法的 Level', () => {
		const valid = new Set<Level>(LEVELS);
		for (const label of Object.values(COURSE_LEVEL_LABEL)) {
			expect(valid.has(label)).toBe(true);
		}
	});
});
