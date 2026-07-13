/* Dream Fly — 活動動態 type (single source of truth)
 *
 * Task 1(C2 死種子退役):ACTIVITY 值已退役——admin/data.ts 的唯一消費者 ActivityPanel
 * 早在 Task F11 就改吃 props(真資料見 admin/api.ts 的 getRecentActivity()),這份
 * mock 陣列已無 runtime 消費者。Activity interface 仍是 ActivityPanel props 的形狀
 * 來源,保留。 */

import type { IconName } from '$lib/icon-registry';

export interface Activity {
	icon: IconName;
	tone: string;
	bg: string;
	text: string;
	time: string;
}
