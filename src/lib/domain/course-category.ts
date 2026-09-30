/* src/lib/domain/course-category.ts — mobile 課程類別表單一來源
 * (R16 Task 6)。
 *
 * 背景：mobile 首頁 / 課程頁 / TrialScreen / api.ts 各自維護一份同樣 6 個類別
 * 的清單（chip 標籤、試上標籤、icon、年齡）。收斂為這裡單一共用常數。
 * 不含 admin/data.ts 的 CATS（ADR-0022）與行銷站 homeContent.ts。 */

import type { IconName } from '$lib/icon-registry';

export interface CourseCategory {
	/** 後端 courses.category 文字值。 */
	key: string;
	/** 首頁分類格 / 課程頁篩選 chip 用的短標籤。 */
	chip: string;
	/** TrialScreen 類別卡用的標籤。 */
	trialLabel: string;
	icon: IconName;
	/** TrialScreen 類別卡的適齡說明。 */
	age: string;
}

export const COURSE_CATEGORIES: CourseCategory[] = [
	{ key: '幼兒體操', chip: '幼兒', trialLabel: '幼兒體操', icon: 'baby', age: '3–5 歲' },
	{ key: '兒童基礎', chip: '兒童', trialLabel: '兒童基礎', icon: 'rotate-cw', age: '6–9 歲' },
	{ key: '競技啦啦隊', chip: '啦啦隊', trialLabel: '競技啦啦隊', icon: 'sparkles', age: '10–16 歲' },
	{ key: '競技體操', chip: '競技', trialLabel: '競技體操', icon: 'medal', age: '8 歲以上' },
	{ key: '成人體操', chip: '成人', trialLabel: '成人體操', icon: 'dumbbell', age: '16 歲以上' },
	{ key: '跑酷', chip: '跑酷', trialLabel: '跑酷 Parkour', icon: 'flame', age: '12 歲以上' }
];

/** 類別 → icon。未知類別（admin 可自由輸入 category 文字）回 graduation-cap。 */
export function courseCategoryIcon(cat: string): IconName {
	return COURSE_CATEGORIES.find((c) => c.key === cat)?.icon ?? 'graduation-cap';
}
