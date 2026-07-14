/* src/lib/domain/course-level.ts — 課程等級：後端 5 值 ↔ 前端繁中標籤單一對照表
 * (Task 18 FE#17)。
 *
 * 背景：後端 course_level 現為 5 值（foundation/beginner/intermediate/advanced/
 * elite，backend Task 7）。三個 surface 原本各自維護一份分歧對照，且都只涵蓋舊
 * 3 值（beginner/intermediate/advanced）——admin（COURSE_LEVEL_TO_CLASS_LEVEL，
 * admin/api.ts）、coach（TodayLevel 型別本身混用 初級/中級/高級/啟蒙/基礎，
 * coach/data.ts）、member（COURSE_LEVEL_LABEL，member/api.ts）——導致 foundation/
 * elite 永遠對不出對應的繁中標籤。收斂為這裡單一共用常數，三 surface 一致
 * import，不再各自分歧；建課/篩選/badge 全走這 5 級。 */

import type { Tone } from '$lib/api/wire';

/** 前端顯示用的 5 級繁中標籤（單一 source of truth，供 admin/coach/member 共用）。 */
export type Level = '啟蒙' | '入門' | '基礎' | '進階' | '選手';

/** Select 選項/走訪順序用的排序陣列（由淺至深）。 */
export const LEVELS: Level[] = ['啟蒙', '入門', '基礎', '進階', '選手'];

/** 後端 course_level enum → 繁中標籤。未知值由呼叫端自行決定 fallback（例如
 *  admin 的 mapCourse() 用 `?? '基礎'`），這裡不預設 fallback，維持純對照表。 */
export const COURSE_LEVEL_LABEL: Record<string, Level> = {
	foundation: '啟蒙',
	beginner: '入門',
	intermediate: '基礎',
	advanced: '進階',
	elite: '選手'
};

/** 5 級課程分級 → Badge tone。批次 1 W2a 單源收斂：production `src` 內原有 4 份
 *  facade 複本（admin/data.ts、mobile-admin/data.ts、member/data.ts、mobile/data.ts）
 *  ＋ CourseCard.svelte 自己的一份，共 5 複本收斂到這裡（member/mobile 兩發 facade
 *  留給 W2b）。docs/design 原型另有一份，是 reference-only、不隨此收斂變動。 */
export const LEVEL_TONE: Record<Level, Tone> = {
	啟蒙: 'info',
	入門: 'info',
	基礎: 'primary',
	進階: 'warning',
	選手: 'accent'
};
