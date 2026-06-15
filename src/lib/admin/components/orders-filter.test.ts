import { describe, it, expect } from 'vitest';
import { ORDERS } from '$lib/admin/data';
import { filterOrders, countByStatus, paidRevenue } from './orders-filter';

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

describe('paidRevenue', () => {
	it('sums amount over paid orders only', () => {
		const expected = ORDERS.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);
		expect(paidRevenue(ORDERS)).toBe(expected);
	});
});
