import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import OrdersTable from './OrdersTable.svelte';
import { search } from '$lib/admin/stores';
import type { Order } from '$lib/admin/data';

/* OrdersTable — the 訂單與金流 table (admin.jsx OrdersView body). Renders status
 * tabs over rows of 訂單編號/學員/項目/優惠/金額/付款方式/經手人/狀態/時間. We render with
 * two hand-built rows so assertions are deterministic and reset the search
 * store between tests (it is a cross-route singleton). */
const paid: Order = {
	id: 'DF-90001',
	member: '測試員',
	initial: '測',
	color: '#0066CC',
	item: '競技啦啦隊 進階班 · 春季',
	amount: 4800,
	status: 'paid',
	method: '信用卡',
	date: '06/08 14:22',
	invoice: 'QX-90000001',
	discount: '—',
	handler: '陳怡君',
	campus: '美村本館',
	tax: 229,
	net: 4571,
	paidAt: '06/08 14:22',
	taxId: '53901240'
};
const pending: Order = {
	id: 'DF-90002',
	member: '催繳員',
	initial: '催',
	color: '#EC4899',
	item: '兒童基礎 B 班 · 春季',
	amount: 3200,
	status: 'pending',
	method: 'ATM 轉帳',
	date: '06/07 19:45',
	invoice: 'QX-90000002',
	discount: '早鳥 9 折',
	handler: '系統自動',
	campus: '東興分館',
	tax: 152,
	net: 3048,
	paidAt: '—（待付款）',
	taxId: '—'
};
// Task 6 (FE#9): fixtures for the 3 statuses the tab set didn't cover before
// this task (處理中/已完成/已取消), plus 已退款 which existed in orders-filter but
// not in this component's test fixtures.
const processing: Order = {
	id: 'DF-90003',
	member: '處理員',
	initial: '處',
	color: '#8B5CF6',
	item: '成人體操 基礎班 · 春季',
	amount: 3600,
	status: 'processing',
	method: '信用卡',
	date: '06/09 09:00',
	invoice: 'QX-90000003',
	discount: '—',
	handler: '林雅婷',
	campus: '美村本館',
	tax: 171,
	net: 3429,
	paidAt: '06/09 09:00',
	taxId: '—'
};
const completed: Order = {
	id: 'DF-90004',
	member: '完成員',
	initial: '完',
	color: '#10B981',
	item: '競技體操 選手班 · 春季',
	amount: 6200,
	status: 'completed',
	method: '信用卡',
	date: '06/10 10:00',
	invoice: 'QX-90000004',
	discount: '—',
	handler: '林雅婷',
	campus: '美村本館',
	tax: 295,
	net: 5905,
	paidAt: '06/10 10:00',
	taxId: '—'
};
const cancelled: Order = {
	id: 'DF-90005',
	member: '取消員',
	initial: '取',
	color: '#EF4444',
	item: '兒童基礎 B 班 · 春季',
	amount: 3200,
	status: 'cancelled',
	method: 'ATM 轉帳',
	date: '06/11 11:00',
	invoice: 'QX-90000005',
	discount: '—',
	handler: '系統自動',
	campus: '東興分館',
	tax: 152,
	net: 3048,
	paidAt: '06/11 11:00',
	taxId: '—'
};
const refunded: Order = {
	id: 'DF-90006',
	member: '退款員',
	initial: '退',
	color: '#F59E0B',
	item: '跑酷入門班 · 體驗',
	amount: 600,
	status: 'refunded',
	method: '信用卡',
	date: '06/12 12:00',
	invoice: 'QX-90000006',
	discount: '體驗折抵',
	handler: '王思齊',
	campus: '東興分館',
	tax: 29,
	net: 571,
	paidAt: '06/12 12:00',
	taxId: '—'
};

beforeEach(() => search.set(''));

describe('OrdersTable', () => {
	it('renders the order id, member name and item', () => {
		const { getByText } = render(OrdersTable, { rows: [paid, pending] });
		expect(getByText('DF-90001')).toBeInTheDocument();
		expect(getByText('測試員')).toBeInTheDocument();
		expect(getByText('競技啦啦隊 進階班 · 春季')).toBeInTheDocument();
	});

	it('renders amounts via fmtNT', () => {
		const { container } = render(OrdersTable, { rows: [paid, pending] });
		expect(container.textContent).toContain('NT$4,800');
		expect(container.textContent).toContain('NT$3,200');
	});

	it('renders order StatusBadge labels (已付款 / 待付款)', () => {
		const { container } = render(OrdersTable, { rows: [paid, pending] });
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('已付款');
		expect(badges).toContain('待付款');
	});

	it('renders the method and handler columns', () => {
		const { container } = render(OrdersTable, { rows: [paid] });
		expect(container.textContent).toContain('信用卡'); // method
		expect(container.textContent).toContain('陳怡君'); // handler
	});

	it('shows the status filter tabs', () => {
		const { getByRole } = render(OrdersTable, { rows: [paid, pending] });
		expect(getByRole('tab', { name: /全部/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /待付款/ })).toBeInTheDocument();
	});

	it('shows all 7 status tabs (全部 + 6) with the ORDER_STATUS 中文 labels', () => {
		const { getByRole } = render(OrdersTable, {
			rows: [paid, pending, processing, completed, cancelled, refunded]
		});
		expect(getByRole('tab', { name: /全部/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /待付款/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /已付款/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /處理中/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /已完成/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /已取消/ })).toBeInTheDocument();
		expect(getByRole('tab', { name: /已退款/ })).toBeInTheDocument();
	});

	it('each tab count badge matches countByStatus (one row per status)', () => {
		const { getByRole } = render(OrdersTable, {
			rows: [paid, pending, processing, completed, cancelled, refunded]
		});
		expect(getByRole('tab', { name: /全部/ }).textContent).toContain('6');
		for (const name of [/待付款/, /已付款/, /處理中/, /已完成/, /已取消/, /已退款/]) {
			expect(getByRole('tab', { name }).textContent).toContain('1');
		}
	});

	it('selecting 處理中 narrows to processing orders only', async () => {
		const { getByRole, container } = render(OrdersTable, {
			rows: [paid, pending, processing, completed, cancelled, refunded]
		});
		await fireEvent.click(getByRole('tab', { name: /處理中/ }));
		expect(container.textContent).toContain(processing.member);
		expect(container.textContent).not.toContain(paid.member);
		expect(container.textContent).not.toContain(completed.member);
		expect(container.textContent).not.toContain(cancelled.member);
	});

	it('selecting 已完成 narrows to completed orders only', async () => {
		const { getByRole, container } = render(OrdersTable, {
			rows: [paid, pending, processing, completed, cancelled, refunded]
		});
		await fireEvent.click(getByRole('tab', { name: /已完成/ }));
		expect(container.textContent).toContain(completed.member);
		expect(container.textContent).not.toContain(processing.member);
		expect(container.textContent).not.toContain(cancelled.member);
	});

	it('selecting 已取消 narrows to cancelled orders only', async () => {
		const { getByRole, container } = render(OrdersTable, {
			rows: [paid, pending, processing, completed, cancelled, refunded]
		});
		await fireEvent.click(getByRole('tab', { name: /已取消/ }));
		expect(container.textContent).toContain(cancelled.member);
		expect(container.textContent).not.toContain(processing.member);
		expect(container.textContent).not.toContain(refunded.member);
	});

	it('filters rows by the search store (matches member name)', () => {
		search.set('催繳員');
		const { container } = render(OrdersTable, { rows: [paid, pending] });
		expect(container.textContent).toContain('催繳員');
		expect(container.textContent).not.toContain('測試員');
		expect(get(search)).toBe('催繳員');
	});

	it('shows an empty message when nothing matches the search', () => {
		search.set('___no-match___');
		const { getByText } = render(OrdersTable, { rows: [paid, pending] });
		expect(getByText('找不到符合的訂單')).toBeInTheDocument();
	});
});
