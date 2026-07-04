import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OrderDialog from './OrderDialog.svelte';
import { ORDERS, type Order } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';

/* OrderDialog — order detail modal (admin.jsx OrderDialog). A centered amount +
 * status badge over a 2-col field grid (id/member/item/campus/discount/method/
 * paidAt/net/tax/invoice/taxId/handler/date), plus 退款原因 when refunded. Footer
 * is always 關閉 + (pending-only) 發送催繳.
 *
 * Task 8 piece 2: the old hardcoded pending→標記已付款 primary is replaced with a
 * 變更狀態 Select (options = legalNextStatuses(order.status)) + 套用 button in the
 * body — the dialog never mutates the order, it only calls onChangeStatus. */
const paid: Order = ORDERS.find((o) => o.status === 'paid')!;
const pending: Order = ORDERS.find((o) => o.status === 'pending')!;
const refunded: Order = ORDERS.find((o) => o.status === 'refunded')!;
const cancelled: Order = { ...ORDERS.find((o) => o.status === 'paid')!, status: 'cancelled' };

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

	it('a pending order shows 發送催繳 (unrelated to status, unchanged) and always shows 關閉', async () => {
		const onRemind = vi.fn();
		const { getByText } = render(OrderDialog, { order: pending, onRemind });

		await fireEvent.click(getByText('發送催繳'));
		expect(onRemind).toHaveBeenCalledTimes(1);
		expect(onRemind.mock.calls[0][0].id).toBe(pending.id);
		expect(getByText('關閉')).toBeInTheDocument();
	});

	it('a paid order shows 關閉 but no 發送催繳 (pending-only)', () => {
		const { getByText, queryByText } = render(OrderDialog, { order: paid });
		expect(getByText('關閉')).toBeInTheDocument();
		expect(queryByText('發送催繳')).toBeNull();
	});

	it('calls onClose from the 關閉 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(OrderDialog, { order: paid, onClose });
		await fireEvent.click(getByText('關閉'));
		expect(onClose).toHaveBeenCalled();
	});

	/* Task 8 piece 2: 變更狀態 Select 只提供 legalNextStatuses(order.status)，讓 admin
	 * 不會踩到後端狀態機的 400 非法轉換。 */
	describe('變更狀態（legalNextStatuses 驅動）', () => {
		it('a pending order offers exactly 已付款/已取消 and defaults to the first option', () => {
			const { getByLabelText } = render(OrderDialog, { order: pending });
			const select = getByLabelText('變更狀態為') as HTMLSelectElement;
			const labels = [...select.options].map((o) => o.textContent);
			expect(labels).toEqual(['已付款', '已取消']);
			expect(select.value).toBe('paid');
		});

		it('a paid order offers 處理中/已退款/已取消 (3 legal transitions)', () => {
			const { getByLabelText } = render(OrderDialog, { order: paid });
			const select = getByLabelText('變更狀態為') as HTMLSelectElement;
			const labels = [...select.options].map((o) => o.textContent);
			expect(labels).toEqual(['處理中', '已退款', '已取消']);
		});

		it('clicking 套用 calls onChangeStatus with the order and the selected next status', async () => {
			const onChangeStatus = vi.fn();
			const { getByLabelText, getByText } = render(OrderDialog, { order: paid, onChangeStatus });

			await fireEvent.change(getByLabelText('變更狀態為'), { target: { value: 'refunded' } });
			await fireEvent.click(getByText('套用'));

			expect(onChangeStatus).toHaveBeenCalledTimes(1);
			expect(onChangeStatus.mock.calls[0][0].id).toBe(paid.id);
			expect(onChangeStatus.mock.calls[0][1]).toBe('refunded');
		});

		it('a terminal-status order (cancelled) shows no 變更狀態 control at all (no legal next state)', () => {
			const { queryByLabelText, queryByText } = render(OrderDialog, { order: cancelled });
			expect(queryByLabelText('變更狀態為')).toBeNull();
			expect(queryByText('套用')).toBeNull();
		});

		it('a refunded order (terminal) shows no 變更狀態 control either', () => {
			const { queryByLabelText } = render(OrderDialog, { order: refunded });
			expect(queryByLabelText('變更狀態為')).toBeNull();
		});
	});
});
