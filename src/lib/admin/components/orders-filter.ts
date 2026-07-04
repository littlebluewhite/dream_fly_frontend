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

/* ───────────────────────── Task 8 piece 2: 訂單狀態變更（PATCH /orders/{id}/status） ─────────────────────────
 * applyMarkPaid（above）is UNTOUCHED — kept for any purely-local preview. The two
 * functions below are the general, real-API-backed replacement: the UI only
 * offers legalNextStatuses()'s options (so a 400 illegal-transition can't be hit
 * by design), and applyStatusChange() folds the PATCH response's new status into
 * the working copy once the call succeeds (persisted truth comes from the API). */

/** 契約 §3.10 訂單狀態機：目前狀態 → 合法的下一狀態清單（不含同狀態幂等）。
 * cancelled/refunded 無合法的下一狀態（終態），回傳空陣列。 */
const LEGAL_NEXT: Record<OrderStatus, OrderStatus[]> = {
	pending: ['paid', 'cancelled'],
	paid: ['processing', 'refunded', 'cancelled'],
	processing: ['completed', 'refunded'],
	completed: ['refunded'],
	cancelled: [],
	refunded: []
};

export function legalNextStatuses(current: OrderStatus): OrderStatus[] {
	return LEGAL_NEXT[current];
}

/**
 * Fold a successful PATCH /orders/{id}/status response into the working copy.
 * Matches by `orderId` (the real backend UUID — `id` above is actually the
 * display order_number, see admin/api.ts's mapAdminOrder). paidAt mirrors the
 * same rule mapAdminOrder already applies on read (pending → placeholder, any
 * other status → the order's date), so the row stays consistent with what a
 * fresh getOrders() would show. Returns a NEW array; the input is never mutated.
 */
export function applyStatusChange(rows: Order[], orderId: string, status: OrderStatus): Order[] {
	return rows.map((o) =>
		o.orderId === orderId ? { ...o, status, paidAt: status === 'pending' ? '—（待付款）' : o.date } : o
	);
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
