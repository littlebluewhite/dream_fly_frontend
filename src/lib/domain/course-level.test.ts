import { describe, it, expect } from 'vitest';
import { LEVELS, COURSE_LEVEL_LABEL, LEVEL_TONE, type Level } from './course-level';
import { LEVELS as ADMIN_LEVELS, LEVEL_TONE as ADMIN_LEVEL_TONE } from '$lib/admin/data';
import { LEVEL_TONE as MOBILE_ADMIN_LEVEL_TONE } from '$lib/mobile-admin/data';
import { F_LEVELS } from '$lib/mobile-admin/form-options';

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

	it('LEVEL_TONE 涵蓋 5 級色階(啟蒙/入門 info、基礎 primary、進階 warning、選手 accent)', () => {
		expect(LEVEL_TONE).toEqual({
			啟蒙: 'info',
			入門: 'info',
			基礎: 'primary',
			進階: 'warning',
			選手: 'accent'
		});
	});
});

/* 單源參照相等（FE#17 收尾）—— admin/mobile-admin 的 LEVELS 複本已收斂為
 * re-export，這裡用 toBe（參照相等，非 toEqual 值相等）證明兩邊拿到的是同一份
 * 陣列，不是各自維護、恰好值相同的複本。 */
describe('單源參照相等 — re-export 而非複本', () => {
	it('admin/data.ts 的 LEVELS 與單源同一份陣列參照', () => {
		expect(ADMIN_LEVELS).toBe(LEVELS);
	});

	it('mobile-admin/form-options.ts 的 F_LEVELS 與單源同一份陣列參照', () => {
		expect(F_LEVELS).toBe(LEVELS);
	});

	it('admin/data.ts 的 LEVEL_TONE 與單源同一份物件參照', () => {
		expect(ADMIN_LEVEL_TONE).toBe(LEVEL_TONE);
	});

	it('mobile-admin/data.ts 的 LEVEL_TONE 與單源同一份物件參照(member/mobile 兩發留給 W2b)', () => {
		expect(MOBILE_ADMIN_LEVEL_TONE).toBe(LEVEL_TONE);
	});
});
