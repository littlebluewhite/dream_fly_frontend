/* Dream Fly — 管理後台 · 訂單與金流 filter derivation.
 *
 * Pure, framework-free port of the React OrdersView body logic
 * (docs/design/admin/admin.jsx): filter by status tab, then by the topbar
 * search term (matches id OR member OR item, case-insensitive — the source
 * matches `o.id + o.member + o.item`). Kept here, unit-testable without
 * rendering, and imported by the orders page/table.
 *
 * R13 Task 5(C4)：訂單狀態變更（LEGAL_NEXT/legalNextStatuses/applyStatusChange/
 * paidRevenue→revenueTotal）已搬到同目錄的 order-status.ts，本檔只留純篩選/計數
 * 這條線。 */

// C4 批4:OrderStatus 改直取 $lib/api/wire(原經 $lib/admin/data 純轉手);Order 是
// admin/data.ts 本檔真內容(.map 衍生形狀),續留原處。
import type { Order } from '$lib/admin/data';
import type { OrderStatus } from '$lib/api/wire';

/** Status tab/chip key. `all` = 全部; the rest mirror OrderStatus. */
export type OrderStatusFilter = 'all' | OrderStatus;

export interface OrdersFilter {
	/** Topbar search term; matched against id + member + item, case-insensitive. */
	query?: string;
	/** Status tab/chip. Defaults to 'all'. */
	status?: OrderStatusFilter;
}

/** Per-status counts for the tab badges (全部 + all 6 OrderStatus values). */
export interface OrderCounts {
	all: number;
	paid: number;
	pending: number;
	refunded: number;
	processing: number;
	completed: number;
	cancelled: number;
}

/** Tally the seven tab counts (全部 + 6 statuses) off the full row set (counts ignore query). */
export function countByStatus(rows: Order[]): OrderCounts {
	return {
		all: rows.length,
		paid: rows.filter((o) => o.status === 'paid').length,
		pending: rows.filter((o) => o.status === 'pending').length,
		refunded: rows.filter((o) => o.status === 'refunded').length,
		processing: rows.filter((o) => o.status === 'processing').length,
		completed: rows.filter((o) => o.status === 'completed').length,
		cancelled: rows.filter((o) => o.status === 'cancelled').length
	};
}

/**
 * Filter the order rows. Order mirrors the source: status tab → search term.
 * Returns a new array; the input is never mutated.
 */
export function filterOrders(rows: Order[], opts: OrdersFilter = {}): Order[] {
	const { query = '', status = 'all' } = opts;

	let out = status === 'all' ? [...rows] : rows.filter((o) => o.status === status);

	const q = query.trim().toLowerCase();
	if (q) {
		out = out.filter((o) => (o.id + o.member + o.item).toLowerCase().includes(q));
	}

	return out;
}
