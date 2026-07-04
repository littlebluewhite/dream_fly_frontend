import { describe, it, expect } from 'vitest';
import { ORDERS } from '$lib/admin/data';
import type { Order, OrderStatus } from '$lib/admin/data';
import { filterOrders, countByStatus, paidRevenue, applyMarkPaid } from './orders-filter';

/* Task 6 (FE#9): the ORDERS seed only carries paid/pending/refunded rows, so a
 * small hand-built fixture (one row per status) is needed to exercise
 * processing/completed/cancelled — the 3 statuses the tab set didn't tally
 * before this task. */
function makeOrder(status: OrderStatus, id: string): Order {
	return {
		id,
		member: '測試員',
		initial: '測',
		color: '#0066CC',
		item: '測試項目',
		amount: 1000,
		status,
		method: '信用卡',
		date: '06/01 00:00',
		invoice: 'QX-TEST',
		discount: '—',
		handler: '測試',
		campus: '測試館',
		tax: 48,
		net: 952,
		paidAt: status === 'pending' ? '—（待付款）' : '06/01 00:00',
		taxId: '—'
	};
}

const SIX_STATUSES: OrderStatus[] = [
	'pending',
	'paid',
	'processing',
	'completed',
	'cancelled',
	'refunded'
];
const ONE_OF_EACH_STATUS: Order[] = SIX_STATUSES.map((s, i) => makeOrder(s, `DF-TEST-${i}`));

/* Pure filter derivation for the 訂單與金流 view (ported from admin.jsx
 * OrdersView). Exercised against the real ORDERS fixture so the behaviour is
 * pinned to production data, no rendering required. */
describe('filterOrders', () => {
	it('empty query + all status returns every row (a fresh array, not the input ref)', () => {
		const out = filterOrders(ORDERS, { query: '', status: 'all' });
		expect(out).toHaveLength(ORDERS.length);
		expect(out).not.toBe(ORDERS);
	});

	it('defaults (no opts) return every row', () => {
		expect(filterOrders(ORDERS)).toHaveLength(ORDERS.length);
	});

	it('status filter narrows to that status only', () => {
		const paid = filterOrders(ORDERS, { status: 'paid' });
		expect(paid.length).toBeGreaterThan(0);
		expect(paid.every((o) => o.status === 'paid')).toBe(true);

		const pending = filterOrders(ORDERS, { status: 'pending' });
		expect(pending.every((o) => o.status === 'pending')).toBe(true);

		const refunded = filterOrders(ORDERS, { status: 'refunded' });
		expect(refunded.every((o) => o.status === 'refunded')).toBe(true);

		// the three status slices partition the full set
		expect(paid.length + pending.length + refunded.length).toBe(ORDERS.length);
	});

	it('narrows to processing/completed/cancelled only (the 3 newly-added statuses)', () => {
		const processing = filterOrders(ONE_OF_EACH_STATUS, { status: 'processing' });
		expect(processing).toHaveLength(1);
		expect(processing.every((o) => o.status === 'processing')).toBe(true);

		const completed = filterOrders(ONE_OF_EACH_STATUS, { status: 'completed' });
		expect(completed).toHaveLength(1);
		expect(completed.every((o) => o.status === 'completed')).toBe(true);

		const cancelled = filterOrders(ONE_OF_EACH_STATUS, { status: 'cancelled' });
		expect(cancelled).toHaveLength(1);
		expect(cancelled.every((o) => o.status === 'cancelled')).toBe(true);
	});

	it('matches by order id (case-insensitive)', () => {
		const target = ORDERS[0];
		const out = filterOrders(ORDERS, { query: target.id.toLowerCase() });
		expect(out.map((o) => o.id)).toContain(target.id);
		expect(out.every((o) => o.id.toLowerCase().includes(target.id.toLowerCase()))).toBe(true);
	});

	it('matches by member name', () => {
		const out = filterOrders(ORDERS, { query: '王承恩' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((o) => o.member.includes('王承恩'))).toBe(true);
	});

	it('matches by item substring', () => {
		const out = filterOrders(ORDERS, { query: '跑酷' });
		expect(out.length).toBeGreaterThan(0);
		expect(out.every((o) => o.item.includes('跑酷'))).toBe(true);
	});

	it('non-matching query returns nothing', () => {
		expect(filterOrders(ORDERS, { query: '___no-such-order___' })).toHaveLength(0);
	});

	it('status + query compose (search applies within the tab)', () => {
		const out = filterOrders(ORDERS, { status: 'paid', query: '啦啦' });
		expect(
			out.every((o) => o.status === 'paid' && (o.id + o.member + o.item).includes('啦啦'))
		).toBe(true);
	});

	it('never mutates the input array', () => {
		const before = ORDERS.map((o) => o.id);
		filterOrders(ORDERS, { status: 'paid', query: '王' });
		expect(ORDERS.map((o) => o.id)).toEqual(before);
	});
});

describe('countByStatus', () => {
	it('counts each status and the total', () => {
		const c = countByStatus(ORDERS);
		expect(c.all).toBe(ORDERS.length);
		expect(c.paid).toBe(ORDERS.filter((o) => o.status === 'paid').length);
		expect(c.pending).toBe(ORDERS.filter((o) => o.status === 'pending').length);
		expect(c.refunded).toBe(ORDERS.filter((o) => o.status === 'refunded').length);
		expect(c.paid + c.pending + c.refunded).toBe(c.all);
	});
});

describe('countByStatus — 全部 6 態（含 processing/completed/cancelled）', () => {
	it('tallies each of the 6 statuses independently', () => {
		const c = countByStatus(ONE_OF_EACH_STATUS);
		expect(c.all).toBe(6);
		expect(c.pending).toBe(1);
		expect(c.paid).toBe(1);
		expect(c.processing).toBe(1);
		expect(c.completed).toBe(1);
		expect(c.cancelled).toBe(1);
		expect(c.refunded).toBe(1);
	});

	it('the 6 status buckets sum back to the total', () => {
		const c = countByStatus(ONE_OF_EACH_STATUS);
		expect(c.pending + c.paid + c.processing + c.completed + c.cancelled + c.refunded).toBe(
			c.all
		);
	});
});

describe('paidRevenue', () => {
	it('sums amount over paid orders only', () => {
		const expected = ORDERS.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);
		expect(paidRevenue(ORDERS)).toBe(expected);
	});
});

/* P2 regression (codex round 1): the orders page derives its 本月已收 / 待付款
 * StatCards from the SAME mutable array the table marks paid, via applyMarkPaid,
 * so the stats can't go stale after 標記已付款. */
describe('applyMarkPaid — KPI/table consistency after 標記已付款', () => {
	const pending = ORDERS.find((o) => o.status === 'pending');

	it('marks the targeted order paid without mutating the input', () => {
		const id = pending!.id;
		const out = applyMarkPaid(ORDERS, id);
		expect(out.find((o) => o.id === id)!.status).toBe('paid');
		expect(ORDERS.find((o) => o.id === id)!.status).toBe('pending');
		expect(out).not.toBe(ORDERS);
	});

	it('moves one order from pending to paid in the derived counts', () => {
		const before = countByStatus(ORDERS);
		const after = countByStatus(applyMarkPaid(ORDERS, pending!.id));
		expect(after.pending).toBe(before.pending - 1);
		expect(after.paid).toBe(before.paid + 1);
	});

	it('adds the order amount to paidRevenue (本月已收) so the stat stays consistent', () => {
		const out = applyMarkPaid(ORDERS, pending!.id);
		expect(paidRevenue(out)).toBe(paidRevenue(ORDERS) + pending!.amount);
	});

	it('is a no-op for an unknown id', () => {
		expect(countByStatus(applyMarkPaid(ORDERS, '___nope___'))).toEqual(countByStatus(ORDERS));
	});

	it('updates paidAt to the order date so OrderDialog 收款時間 stays consistent', () => {
		const o = pending!;
		expect(o.paidAt).toBe('—（待付款）'); // pending shows the placeholder
		const out = applyMarkPaid(ORDERS, o.id);
		expect(out.find((x) => x.id === o.id)!.paidAt).toBe(o.date);
	});
});
