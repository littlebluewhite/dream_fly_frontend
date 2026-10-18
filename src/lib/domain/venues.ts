/* Dream Fly — 場館型別與狀態查表 (single source of truth)
 *
 * Task F4：欄位收斂到 VenueResponse 真實欄位——area/cap/今日排課(today)是後端無來源
 * 的裝飾欄位，已移除(見 admin/api.ts mapVenue() 註解)；新增 slug(VenueResponse.slug)
 * ，場館編輯對話框改顯示這個而非內部 id。 */

import type { Tone } from '$lib/api/wire';

export interface Venue {
	id: string;
	slug: string;
	name: string;
	type: string;
	equip: string[];
	status: 'available' | 'maintenance';
}

/** 場館狀態 union（admin/mobile-admin 共用查表鍵）。 */
export type VenueStatus = 'available' | 'maintenance';

/** 場館狀態 → [Tone, 中文標籤]。canonical 標籤＝可預約——mobile-admin 舊版原本獨立
 *  維護一份、標籤是「可使用」，語意相同但字面不同，屬靜默發散；隨本次單源收斂統一為
 *  「可預約」（見 ADR 0013）。 */
export const VENUE_STATUS: Record<VenueStatus, [Tone, string]> = {
	available: ['success', '可預約'],
	maintenance: ['warning', '維護中']
};
