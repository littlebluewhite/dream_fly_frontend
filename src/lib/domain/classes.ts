/* src/lib/domain/classes.ts — ClassBase 型別 + 課程招生狀態查表
 *
 * R15(候選 F-3，誠實開機)：本檔原本的課程種子陣列已退役——唯一消費者 mobile-admin/data.ts
 * 的班級 builder 隨誠實開機一併移除(值改由真 GET /courses 水合，見
 * mobile-admin/stores.ts opsGate)。ClassBase 介面保留——仍被 admin/data.ts 的
 * ClassRow 繼承。 */

import type { Level } from './course-level';
import type { Tone } from '$lib/api/wire';

export interface ClassBase {
	id: string;
	name: string;
	level: Level;
	cat: string;
	coach: string;
	day: string;
	time: string;
	enrolled: number;
	cap: number;
	age: string;
	price: number;
	status: '招生中' | '候補' | '額滿';
	wait: number;
}

/** 課程招生狀態 union（admin/mobile-admin 共用查表鍵）。 */
export type ClassStatus = '招生中' | '候補' | '額滿';

/** 課程招生狀態 → Tone（plain Tone lookup，非 [Tone, label] tuple——狀態字串本身
 *  就是顯示標籤）。 */
export const STATUS_TONE: Record<ClassStatus, Tone> = {
	招生中: 'success',
	候補: 'warning',
	額滿: 'neutral'
};
