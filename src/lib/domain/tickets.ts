/* Dream Fly — 票券型別與類型查表 (single source of truth) */

import type { IconName } from '$lib/icon-registry';
import { lookupOr, type Tone } from '$lib/api/wire';
import type { ProductType } from '$lib/api/generated';

export interface Ticket {
	id: string;
	name: string;
	// ProductResponse.product_type 的直接映射（Task F1 收斂）——merchandise 已被
	// getTickets() 濾除，不會出現在這裡；不再是舊版無後端來源的 pass/trial/event 分組。
	type: TicketType;
	price: number;
	sold: number;
	quota: number | null; // null = 不限（見 ProductResponse.quota，src/lib/admin/api.ts getTickets()）
	color: string;
	icon: IconName;
	desc: string;
}

/** 方案類型 union（admin/mobile-admin 共用查表鍵）：由生成的 ProductType 去掉 merchandise 推導，
 *  後端多一個值、bindings 同步後，下方 TICKET_TYPE 少鍵即編譯錯誤。 */
export type TicketType = Exclude<ProductType, 'merchandise'>;

/** 票券類型 → [Tone, 中文標籤]。 */
export const TICKET_TYPE: Record<TicketType, [Tone, string]> = {
	ticket: ['accent', '單次票券'],
	membership: ['primary', '月票方案'],
	course_package: ['success', '課程套裝']
};

/** 容忍未知字串的方案類型查表：查無（只認自有鍵）→ ['neutral', 原字串]。寫法同 api/wire.ts 的 orderStatusBadge，
 *  後端 product_type 多一個值時不會 destructure 到 undefined 而炸頁。 */
export const ticketTypeBadge = (t: string): [Tone, string] =>
	lookupOr<[Tone, string]>(TICKET_TYPE, t, ['neutral', t]);
