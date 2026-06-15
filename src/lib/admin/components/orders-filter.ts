/* Dream Fly — 管理後台 · 訂單與金流 filter derivation.
 *
 * Pure, framework-free port of the React OrdersView body logic
 * (docs/design/admin/admin.jsx): filter by status tab, then by the topbar
 * search term (matches id OR member OR item, case-insensitive — the source
 * matches `o.id + o.member + o.item`). Kept here, unit-testable without
 * rendering, and imported by the orders page/table. */

import type { Order, OrderStatus } from '$lib/admin/data';

/** Status tab/chip key. `all` = 全部; the rest mirror OrderStatus. */
export type OrderStatusFilter = 'all' | OrderStatus;

export interface OrdersFilter {
	/** Topbar search term; matched against id + member + item, case-insensitive. */
	query?: string;
	/** Status tab/chip. Defaults to 'all'. */
	status?: OrderStatusFilter;
}

/** Per-status counts for the tab badges (全部 / 已付款 / 待付款 / 已退款). */
export interface OrderCounts {
	all: number;
	paid: number;
	pending: number;
	refunded: number;
}

/** Tally the four tab counts off the full row set (counts ignore query). */
export function countByStatus(rows: Order[]): OrderCounts {
	return {
		all: rows.length,
		paid: rows.filter((o) => o.status === 'paid').length,
		pending: rows.filter((o) => o.status === 'pending').length,
		refunded: rows.filter((o) => o.status === 'refunded').length
	};
}

/** Sum of `amount` over already-paid orders — the 本月已收 stat. */
export function paidRevenue(rows: Order[]): number {
	return rows.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);
}

/**
 * Mark one order paid, returning a NEW array (input never mutated). The orders
 * page derives BOTH the table and the summary KPIs (本月已收 / 待付款) from the
 * result, so they stay consistent after 標記已付款.
 */
export function applyMarkPaid(rows: Order[], id: string): Order[] {
	// flip status AND the displayed 收款時間 together (paidAt mirrors the paid
	// branch of the source enrichment: o.date) so OrderDialog stays consistent.
	return rows.map((o) => (o.id === id ? { ...o, status: 'paid', paidAt: o.date } : o));
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
