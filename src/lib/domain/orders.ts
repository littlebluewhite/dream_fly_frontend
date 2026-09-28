/* src/lib/domain/orders.ts — OrderBase 型別
 *
 * R15(候選 F-3，誠實開機)：本檔原本的訂單種子陣列已退役——唯一消費者 mobile-admin/data.ts
 * 的訂單 builder 隨誠實開機一併移除(值改由真 GET /orders 水合，見
 * mobile-admin/stores.ts opsGate)。OrderBase 介面保留——仍被 admin/data.ts 的
 * Order 繼承。 */

import type { OrderStatus } from '$lib/api/wire';

export interface OrderBase {
	id: string;
	member: string;
	initial: string;
	color: string;
	item: string;
	amount: number;
	status: OrderStatus;
	method: string;
	date: string;
	invoice: string;
	discount: string;
	handler: string;
	reason?: string;
}

