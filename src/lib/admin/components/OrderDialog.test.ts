import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OrderDialog from './OrderDialog.svelte';
import { ORDERS, type Order } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';

/* OrderDialog — read-only order detail modal (admin.jsx OrderDialog). A centered
 * amount + status badge over a 2-col field grid (id/member/item/campus/discount/
 * method/paidAt/net/tax/invoice/taxId/handler/date), plus 退款原因 when refunded.
 * Pending orders expose 標記已付款 + 發送催繳; others only 關閉. */
const paid: Order = ORDERS.find((o) => o.status === 'paid')!;
const pending: Order = ORDERS.find((o) => o.status === 'pending')!;
const refunded: Order = ORDERS.find((o) => o.status === 'refunded')!;

describe('OrderDialog', () => {
	it('renders nothing actionable when order is null', () => {
		const { queryByText } = render(OrderDialog, { order: null });
		expect(queryByText('訂單明細')).toBeNull();
	});

	it('renders the order id, member, item and the status label', () => {
		const { getByText, container } = render(OrderDialog, { order: paid });
		expect(getByText(paid.id)).toBeInTheDocument();
		expect(getByText(paid.member)).toBeInTheDocument();
		expect(getByText(paid.item)).toBeInTheDocument();
		// status badge shows 已付款 (paid)
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('已付款');
	});

	it('renders amount, tax and net as fmtNT money', () => {
		const { container } = render(OrderDialog, { order: paid });
		expect(container.textContent).toContain(fmtNT(paid.amount)); // 訂單金額
		expect(container.textContent).toContain(fmtNT(paid.tax)); // 營業稅 5%
		expect(container.textContent).toContain(fmtNT(paid.net)); // 未稅金額
	});

	it('renders the paidAt, taxId, invoice, method and campus fields', () => {
		const { container } = render(OrderDialog, { order: paid });
		expect(container.textContent).toContain(paid.paidAt);
		expect(container.textContent).toContain(paid.taxId);
		expect(container.textContent).toContain(paid.invoice);
		expect(container.textContent).toContain(paid.method);
		expect(container.textContent).toContain(paid.campus);
		expect(container.textContent).toContain(paid.handler);
	});

	it('shows the 退款原因 reason for a refunded order', () => {
		const { container, getByText } = render(OrderDialog, { order: refunded });
		expect(getByText('退款原因')).toBeInTheDocument();
		expect(container.textContent).toContain(refunded.reason as string);
		// refunded status label present
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges).toContain('已退款');
	});

	it('omits 退款原因 for a non-refunded order', () => {
		const { queryByText } = render(OrderDialog, { order: paid });
		expect(queryByText('退款原因')).toBeNull();
	});

	it('a pending order shows 標記已付款 + 發送催繳 and wires the callbacks', async () => {
		const onMarkPaid = vi.fn();
		const onRemind = vi.fn();
		const { getByText } = render(OrderDialog, { order: pending, onMarkPaid, onRemind });

		await fireEvent.click(getByText('發送催繳'));
		expect(onRemind).toHaveBeenCalledTimes(1);
		expect(onRemind.mock.calls[0][0].id).toBe(pending.id);

		await fireEvent.click(getByText('標記已付款'));
		expect(onMarkPaid).toHaveBeenCalledTimes(1);
		expect(onMarkPaid.mock.calls[0][0].id).toBe(pending.id);
	});

	it('a paid order shows only 關閉 (no mark-paid / remind actions)', () => {
		const { getByText, queryByText } = render(OrderDialog, { order: paid });
		expect(getByText('關閉')).toBeInTheDocument();
		expect(queryByText('標記已付款')).toBeNull();
		expect(queryByText('發送催繳')).toBeNull();
	});

	it('calls onClose from the 關閉 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(OrderDialog, { order: paid, onClose });
		await fireEvent.click(getByText('關閉'));
		expect(onClose).toHaveBeenCalled();
	});
});
