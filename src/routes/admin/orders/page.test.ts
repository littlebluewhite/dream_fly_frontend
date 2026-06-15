import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { ORDERS } from '$lib/admin/data';
import { search } from '$lib/admin/stores';
import { fmtNT } from '$lib/admin/format';
import { countByStatus, paidRevenue } from '$lib/admin/components/orders-filter';

/* 訂單與金流 page — PageHead + four summary StatCards (本月已收/待付款/本月訂單/退款)
 * + the orders table. We assert the heading, the derived summary numbers, and
 * that real ORDERS rows render with their StatusBadge + fmtNT amounts. */
beforeEach(() => search.set(''));

describe('orders +page', () => {
	it('renders the 訂單與金流 heading and the 匯出對帳單 action', () => {
		const { getByText } = render(Page);
		expect(getByText('訂單與金流')).toBeInTheDocument();
		expect(getByText('匯出對帳單')).toBeInTheDocument();
	});

	it('renders the four summary StatCards with derived values', () => {
		const { container } = render(Page);
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

	it('renders real order rows with a StatusBadge and fmtNT amount', () => {
		const { container } = render(Page);
		const first = ORDERS[0];
		expect(container.textContent).toContain(first.id);
		expect(container.textContent).toContain(first.member);
		expect(container.textContent).toContain(fmtNT(first.amount));
		// at least one order status badge label is present
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges.some((b) => b === '已付款' || b === '待付款' || b === '已退款')).toBe(true);
	});
});
