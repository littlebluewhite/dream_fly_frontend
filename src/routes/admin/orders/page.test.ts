import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { ORDERS } from '$lib/admin/data';
import { search, toasts } from '$lib/admin/stores';
import { fmtNT } from '$lib/admin/format';
import { countByStatus, paidRevenue } from '$lib/admin/components/orders-filter';
import { getOrders, updateOrderStatus } from '$lib/admin/api';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({ getOrders: vi.fn(), updateOrderStatus: vi.fn() }));

beforeEach(() => {
	search.set('');
	vi.mocked(getOrders).mockReset();
	vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: ORDERS.length, page: 1, perPage: 20 });
	vi.mocked(updateOrderStatus).mockReset();
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

describe('orders +page — 變更狀態接真 API（Task 8 piece 2：PATCH /orders/{id}/status）', () => {
	it('點開一筆 paid 訂單、選「已退款」並套用 → 呼叫 updateOrderStatus(真實 orderId, next)，成功後 KPI/表格反映新狀態', async () => {
		const target = ORDERS.find((o) => o.status === 'paid')!;
		const initial = countByStatus(ORDERS);
		vi.mocked(updateOrderStatus).mockResolvedValue({
			id: target.orderId,
			order_number: target.id,
			status: 'refunded'
		});

		const { getByText, getByLabelText, findByText, container } = render(Page);
		await findByText(target.id);
		await fireEvent.click(getByText(target.id));
		await fireEvent.change(getByLabelText('變更狀態為'), { target: { value: 'refunded' } });
		await fireEvent.click(getByText('套用'));

		await vi.waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));
		expect(updateOrderStatus).toHaveBeenCalledWith(target.orderId, 'refunded'); // 真實 uuid，不是顯示用 id

		await vi.waitFor(() => {
			expect(container.textContent).toContain(initial.refunded + 1 + ' 筆'); // 退款 KPI +1
		});
	});

	it('狀態更新失敗（400 非法轉換）→ 顯示繁中錯誤 toast，KPI 維持原值（未套用任何本地變更）', async () => {
		const target = ORDERS.find((o) => o.status === 'paid')!;
		vi.mocked(updateOrderStatus).mockRejectedValue(new ApiError(400, 'illegal status transition'));
		const before = get(toasts).length;
		const initial = countByStatus(ORDERS);

		const { getByText, findByText, container } = render(Page);
		await findByText(target.id);
		await fireEvent.click(getByText(target.id));
		await fireEvent.click(getByText('套用')); // 預設選項（第一個合法下一狀態）

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不合法');

		// 失敗時 catch 分支不套用任何本地變更，本月訂單總數（不受狀態變更影響的基準值）
		// 與待付款筆數（跟這筆 paid→refunded 嘗試無關）皆維持原值。
		expect(container.textContent).toContain(initial.all + ' 筆');
		expect(container.textContent).toContain(initial.pending + ' 筆');
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

describe('orders +page — 分頁（Task 17：PaginationBar 接上 getOrders() 的 total/page/perPage）', () => {
	it('依 getOrders() 回應渲染「第 x 頁，共 M 筆」，邊界頁按鈕 disabled', async () => {
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].id);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → 呼叫 getOrders(2)，並依新回應重新渲染頁碼', async () => {
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].id);

		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(getOrders).toHaveBeenCalledWith(2);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 3, perPage: 20 });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].id);

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('orders +page — 複審修復（Finding 1）：搜尋/篩選僅作用於目前頁面的提示', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].id);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 20, page: 1, perPage: 20 });
		const { findByText, queryByText } = render(Page);
		await findByText(ORDERS[0].id);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('orders +page — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新呼叫 getOrders', async () => {
		vi.mocked(getOrders).mockResolvedValue({ orders: ORDERS, total: 45, page: 1, perPage: 20 });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].id);

		vi.mocked(getOrders).mockRejectedValueOnce(new Error('network'));
		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		vi.mocked(getOrders).mockResolvedValueOnce({ orders: ORDERS, total: 45, page: 2, perPage: 20 });
		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(getOrders).toHaveBeenLastCalledWith(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
	});
});
