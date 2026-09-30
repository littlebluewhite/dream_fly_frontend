import { describe, it, expect } from 'vitest';
import { COURSE_CATEGORIES, courseCategoryIcon } from './course-category';
import { ICONS } from '$lib/icon-registry';

/* mobile 課程類別表——釘住從 mobile 首頁/課程頁/TrialScreen/api 收斂前的值。 */
describe('course-category — mobile 課程類別表', () => {
	it('依序涵蓋 6 個類別，值與收斂前各處一致', () => {
		expect(COURSE_CATEGORIES).toEqual([
			{ key: '幼兒體操', chip: '幼兒', trialLabel: '幼兒體操', icon: 'baby', age: '3–5 歲' },
			{ key: '兒童基礎', chip: '兒童', trialLabel: '兒童基礎', icon: 'rotate-cw', age: '6–9 歲' },
			{ key: '競技啦啦隊', chip: '啦啦隊', trialLabel: '競技啦啦隊', icon: 'sparkles', age: '10–16 歲' },
			{ key: '競技體操', chip: '競技', trialLabel: '競技體操', icon: 'medal', age: '8 歲以上' },
			{ key: '成人體操', chip: '成人', trialLabel: '成人體操', icon: 'dumbbell', age: '16 歲以上' },
			{ key: '跑酷', chip: '跑酷', trialLabel: '跑酷 Parkour', icon: 'flame', age: '12 歲以上' }
		]);
	});

	it('每個 icon 都是已註冊的 icon 名稱', () => {
		for (const c of COURSE_CATEGORIES) expect(ICONS).toHaveProperty(c.icon);
	});

	it('courseCategoryIcon：已知類別回其 icon，未知類別回 graduation-cap', () => {
		expect(courseCategoryIcon('競技體操')).toBe('medal');
		expect(courseCategoryIcon('不存在的類別')).toBe('graduation-cap');
		expect(courseCategoryIcon('')).toBe('graduation-cap');
	});
});
