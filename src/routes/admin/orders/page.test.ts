import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import type { AdminOrderSummary } from '$lib/api/generated';
import { search, toasts } from '$lib/admin/stores';
import { fmtNT } from '$lib/format';
import { adminOrderSummary, orderResponse } from '$lib/testing/wire-fixtures';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';

/* W-8：改 mock $lib/api/client 的 api()，getOrders/updateOrderStatus 走真 mapper
 * (GET /orders?page=n、PATCH /orders/{id}/status)。fixture 改為 wire 形狀——舊的
 * 已映射 Order 列帶 method('信用卡'/'ATM 轉帳')等 wire 沒有的假欄位，隨之消失。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// 3 筆：1 筆 paid(供「變更狀態接真 API」測試 find 到目標)+ 1 筆 pending + 1 筆 refunded。
const ORDERS: AdminOrderSummary[] = [
	adminOrderSummary({ id: 'uuid-DF-24061', order_number: 'DF-24061', user_name: '王承恩', status: 'paid', total_cents: 480000, items: [{ name: '競技啦啦隊 進階班 · 春季', quantity: 1 }] }),
	adminOrderSummary({ id: 'uuid-DF-24059', order_number: 'DF-24059', user_name: '李宥蓁', status: 'pending', paid_at: null, total_cents: 320000, items: [{ name: '兒童基礎 B 班 · 春季', quantity: 1 }] }),
	adminOrderSummary({ id: 'uuid-DF-24057', order_number: 'DF-24057', user_name: '周哲瑋', status: 'refunded', total_cents: 60000, coupon_code: '體驗折抵', items: [{ name: '跑酷入門班 · 體驗', quantity: 1 }] })
];
const PAID = ORDERS[0];
/* ORDERS 的狀態計數與本頁已收(只算 paid，refunded 不入)。 */
const COUNTS = { all: 3, pending: 1, refunded: 1 };
const PAID_REVENUE = 4800;

/** StatCard 的 value 文字(label 前一個兄弟節點)，用來精確斷言 KPI，不靠子字串。 */
const kpi = (container: HTMLElement, label: string) =>
	[...container.querySelectorAll('div')].find((d) => d.textContent === label)?.previousElementSibling?.textContent?.trim();

const page = (n: number, total = ORDERS.length) => ({ orders: ORDERS, total, page: n, per_page: 20 });

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /orders?page=1': page(1), ...overrides }, ADMIN_ROUTES));

beforeEach(() => {
	search.set('');
	vi.mocked(api).mockReset();
	route();
});

/* 訂單與金流 page — PageHead + four summary StatCards (本頁已收/待付款/本頁訂單/退款)
 * + the orders table. We assert the heading, the derived summary numbers, and
 * that real ORDERS rows render with their StatusBadge + fmtNT amounts. Data now
 * arrives through GET /orders?page=n (async), so every assertion first awaits
 * the ready phase.
 *
 * R13 Task 5(C4)：本月已收/本月訂單改本頁已收/本頁訂單（分頁下兩個數字都只算
 * 已載入的這一頁，paidRevenue 改名 revenueTotal）。 */
describe('orders +page', () => {
	it('renders the 訂單與金流 heading and the 匯出對帳單 action', async () => {
		const { getByText, findByText } = render(Page);
		await findByText(ORDERS[0].order_number);
		expect(getByText('訂單與金流')).toBeInTheDocument();
		expect(getByText('匯出對帳單')).toBeInTheDocument();
	});

	it('renders the four summary StatCards with derived values', async () => {
		const { container, findByText } = render(Page);
		await findByText(ORDERS[0].order_number);
		expect(container.textContent).toContain('本頁已收');
		expect(container.textContent).toContain(fmtNT(PAID_REVENUE)); // 本頁已收 value
		expect(container.textContent).toContain('待付款');
		expect(container.textContent).toContain(COUNTS.pending + ' 筆');
		expect(container.textContent).toContain('本頁訂單');
		expect(container.textContent).toContain(COUNTS.all + ' 筆');
		expect(kpi(container, '退款')).toBe(COUNTS.refunded + ' 筆');
	});

	it('renders real order rows with a StatusBadge and fmtNT amount', async () => {
		const { container, findByText } = render(Page);
		await findByText(ORDERS[0].order_number);
		const first = ORDERS[0];
		expect(container.textContent).toContain(first.order_number);
		expect(container.textContent).toContain(first.user_name);
		expect(container.textContent).toContain(fmtNT(first.total_cents / 100));
		// at least one order status badge label is present
		const badges = [...container.querySelectorAll('.badge')].map((b) => b.textContent?.trim());
		expect(badges.some((b) => b === '已付款' || b === '待付款' || b === '已退款')).toBe(true);
	});
});

describe('orders +page — 變更狀態接真 API（Task 8 piece 2：PATCH /orders/{id}/status）', () => {
	it('點開一筆 paid 訂單、選「已退款」並套用 → PATCH /orders/{真實 uuid}/status，成功後 KPI/表格反映新狀態', async () => {
		const target = PAID;
		route({ [`PATCH /orders/${target.id}/status`]: orderResponse({ id: target.id, order_number: target.order_number, status: 'refunded' }) });

		const { getByText, getByLabelText, findByText, container } = render(Page);
		await findByText(target.order_number);
		await fireEvent.click(getByText(target.order_number));
		await fireEvent.change(getByLabelText('變更狀態為'), { target: { value: 'refunded' } });
		await fireEvent.click(getByText('套用'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /orders/${target.id}/status`)).toHaveLength(1)); // 真實 uuid，不是顯示用 order_number
		expect(apiBody(`PATCH /orders/${target.id}/status`)).toEqual({ status: 'refunded' });

		await vi.waitFor(() => {
			expect(kpi(container, '退款')).toBe(COUNTS.refunded + 1 + ' 筆'); // 退款 KPI +1
		});
	});

	it('狀態更新失敗（400 非法轉換）→ 顯示繁中錯誤 toast，KPI 維持原值（未套用任何本地變更）', async () => {
		const target = PAID;
		route({ [`PATCH /orders/${target.id}/status`]: new ApiError(400, 'illegal status transition') });
		const before = get(toasts).length;

		const { getByText, findByText, container } = render(Page);
		await findByText(target.order_number);
		await fireEvent.click(getByText(target.order_number));
		await fireEvent.click(getByText('套用')); // 預設選項（第一個合法下一狀態）

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不合法');

		// 失敗時不套用任何本地變更，本頁訂單總數（不受狀態變更影響的基準值）與
		// 待付款筆數（跟這筆 paid→refunded 嘗試無關）皆維持原值。
		expect(container.textContent).toContain(COUNTS.all + ' 筆');
		expect(container.textContent).toContain(COUNTS.pending + ' 筆');
	});

	/* R13 Task 5(C4) 回歸：已對過後端 update_order_status，409 只在退款/取消補償
	 * 撞點數不足（Conflict("點數不足")）時發生——桌面舊碼把 409 併進「連線問題」
	 * 通用 fallback，這裡釘住新增的專屬點數不足文案。 */
	it('狀態更新失敗（409 點數不足）→ 顯示點數不足專屬 toast，KPI 維持原值', async () => {
		const target = PAID;
		route({ [`PATCH /orders/${target.id}/status`]: new ApiError(409, '點數不足') });
		const before = get(toasts).length;

		const { getByText, findByText, container } = render(Page);
		await findByText(target.order_number);
		await fireEvent.click(getByText(target.order_number));
		await fireEvent.click(getByText('套用')); // 預設選項（第一個合法下一狀態）

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toBe(
			'會員已使用本單回饋點數，餘額不足以扣回，無法退款或取消。'
		);
		expect(container.textContent).toContain(COUNTS.all + ' 筆');
	});
});

describe('orders +page — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /orders?page=1': new Error('network') });
		const { findByText } = render(Page);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(Page);
		expect(getByTestId('orders-skeleton')).toBeTruthy();
	});
});

describe('orders +page — 分頁（Task 17：PaginationBar 接上 GET /orders 的 total/page/per_page）', () => {
	it('依 GET /orders 回應渲染「第 x 頁，共 M 筆」，邊界頁按鈕 disabled', async () => {
		route({ 'GET /orders?page=1': page(1, 45) });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].order_number);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → GET /orders?page=2，並依新回應重新渲染頁碼', async () => {
		route({ 'GET /orders?page=1': page(1, 45), 'GET /orders?page=2': page(2, 45) });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].order_number);

		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /orders?page=2')).toHaveLength(1);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		route({ 'GET /orders?page=1': page(3, 45) });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].order_number);

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('orders +page — 複審修復（Finding 1）：搜尋/篩選僅作用於目前頁面的提示', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		route({ 'GET /orders?page=1': page(1, 45) });
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].order_number);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		route({ 'GET /orders?page=1': page(1, 20) });
		const { findByText, queryByText } = render(Page);
		await findByText(ORDERS[0].order_number);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('orders +page — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新 GET /orders', async () => {
		let page2Calls = 0;
		route({
			'GET /orders?page=1': page(1, 45),
			'GET /orders?page=2': () => (++page2Calls === 1 ? new Error('network') : page(2, 45))
		});
		const { findByText, getByText } = render(Page);
		await findByText(ORDERS[0].order_number);

		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /orders?page=2')).toHaveLength(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
		expect(apiCalls('GET /orders?page=1')).toHaveLength(1);
	});
});
