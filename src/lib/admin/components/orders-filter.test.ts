import { describe, it, expect } from 'vitest';
import type { Order } from '$lib/admin/data';
import type { OrderStatus } from '$lib/api/wire';
import { filterOrders, countByStatus } from './orders-filter';

/* Task 1(C2 死種子退役):admin/data.ts 的 ORDERS(值)已退役——這裡改為檔內 inline
 * fixture，比照真實 ORDERS_BASE 只出現 paid/pending/refunded 三態的現況(Task 6
 * FE#9 的既有前提)，維持「paid+pending+refunded 三態切片加總 = 全集」這條測試
 * 前提成立。 */
const ORDERS: Order[] = [
	{ id: 'DF-24061', member: '王承恩', initial: '王', color: '#0066CC', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: '信用卡', date: '06/08 14:22', discount: '—', tax: 229, net: 4571, paidAt: '06/08 14:22', orderId: 'uuid-DF-24061' },
	{ id: 'DF-24059', member: '李宥蓁', initial: '李', color: '#0EA5E9', item: '兒童基礎 B 班 · 春季', amount: 3200, status: 'pending', method: 'ATM 轉帳', date: '06/07 19:45', discount: '—', tax: 152, net: 3048, paidAt: '—（待付款）', orderId: 'uuid-DF-24059' },
	{ id: 'DF-24057', member: '周哲瑋', initial: '周', color: '#10B981', item: '跑酷入門班 · 體驗', amount: 600, status: 'refunded', method: '信用卡', date: '06/06 10:12', discount: '體驗折抵', tax: 29, net: 571, paidAt: '06/06 10:12', orderId: 'uuid-DF-24057', reason: '家長申請改期，全額退款' },
	{ id: 'DF-24058', member: '吳冠霖', initial: '吳', color: '#0066CC', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: '信用卡', date: '06/07 16:30', discount: '續報 -300', tax: 295, net: 5905, paidAt: '06/07 16:30', orderId: 'uuid-DF-24058' }
];

/* Task 6 (FE#9): the ORDERS fixture above only carries paid/pending/refunded
 * rows, so a small hand-built fixture (one row per status) is needed to
 * exercise processing/completed/cancelled — the 3 statuses the tab set didn't
 * tally before this task. */
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
		discount: '—',
		tax: 48,
		net: 952,
		paidAt: status === 'pending' ? '—（待付款）' : '06/01 00:00',
		orderId: 'uuid-' + id
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

	it('trims leading/trailing whitespace from the query before matching', () => {
		const out = filterOrders(ORDERS, { query: ' 王承恩 ' });
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

/* legalNextStatuses/applyStatusChange/paidRevenue（→revenueTotal）搬到
 * order-status.test.ts（R13 Task 5，C4）——連同它們的測試一併搬走，這裡不留
 * 重複。 */
