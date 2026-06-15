import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
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
