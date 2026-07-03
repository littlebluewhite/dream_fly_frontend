import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { ORDERS } from '$lib/admin/data';
import { search } from '$lib/admin/stores';
import { fmtNT } from '$lib/admin/format';
import { countByStatus, paidRevenue } from '$lib/admin/components/orders-filter';
import { getOrders } from '$lib/admin/api';

vi.mock('$lib/admin/api', () => ({ getOrders: vi.fn() }));

beforeEach(() => {
	search.set('');
	vi.mocked(getOrders).mockReset();
	vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS });
});

/* 訂單與金流 page — PageHead + four summary StatCards (本月已收/待付款/本月訂單/退款)
 * + the orders table. We assert the heading, the derived summary numbers, and
 * that real ORDERS rows render with their StatusBadge + fmtNT amounts. Data now
 * arrives through the getOrders() seam (async), so every assertion first awaits
 * the ready phase. */
describe('orders +page', () => {
	it('renders the 訂單與金流 heading and the 匯出對帳單 action', async () => {
		const { getByText, findByText } = render(Page);
		await findByText(ORDERS[0].id);
		expect(getByText('訂單與金流')).toBeInTheDocument();
		expect(getByText('匯出對帳單')).toBeInTheDocument();
	});

	it('renders the four summary StatCards with derived values', async () => {
		const { container, findByText } = render(Page);
		await findByText(ORDERS[0].id);
		const c = countByStatus(ORDERS);
		expect(container.textContent).toContain('本月已收');
		expect(container.textContent).toContain(fmtNT(paidRevenue(ORDERS))); // 本月已收 value
		expect(container.textContent).toContain('待付款');
		expect(container.textContent).toContain(c.pending + ' 筆');
		expect(container.textContent).toContain('本月訂單');
		expect(container.textContent).toContain(c.all + ' 筆');
		expect(container.textContent).toContain('退款');
		expect(container.textContent).toContain(c.refunded + ' 筆');
	});

	it('renders real order rows with a StatusBadge and fmtNT amount', async () => {
		const { container, findByText } = render(Page);
		await findByText(ORDERS[0].id);
		const first = ORDERS[0];
		expect(container.textContent).toContain(first.id);
		expect(container.textContent).toContain(first.member);
		expect(container.textContent).toContain(fmtNT(first.amount));
		// at least one order status badge label is present
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges.some((b) => b === '已付款' || b === '待付款' || b === '已退款')).toBe(true);
	});
});

describe('orders +page — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getOrders).mockReset();
		vi.mocked(getOrders).mockRejectedValue(new Error('network'));
		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getOrders).mockReset();
		vi.mocked(getOrders).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(Page);
		expect(getByTestId('orders-skeleton')).toBeTruthy();
	});
});
