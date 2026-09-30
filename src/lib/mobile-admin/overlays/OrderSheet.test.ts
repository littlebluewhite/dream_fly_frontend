import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import OrderSheet from './OrderSheet.svelte';
import { orders, toasts } from '$lib/mobile-admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import type { Order as OrderRow } from '$lib/admin/data';

/* R15 Task 3a(候選 轉手退役):改 mock $lib/api/client 的 api(),讓 updateOrderStatus
 * (OrderSheet 經 stores.ts 直取 $lib/admin/api)走真實 PATCH /orders/{id}/status
 * 呼叫,同 CertificateDialog.test.ts 慣例。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* R15(候選 F-3，誠實開機):$orders 開機為 `[]`——本檔各 it 原本直讀 $orders 的同步
 * seed 取一筆 pending 訂單，改為自帶 fixture、beforeEach 灌進 store。 */
const PENDING_ORDER_FIXTURE: OrderRow = {
	id: 'DF-TEST', member: '測試學員', initial: '測', color: '#0066CC', item: '測試班級', amount: 3200,
	status: 'pending', method: '信用卡', date: '2026/06/08', discount: '—', tax: 152, net: 3048, paidAt: '—（待付款）', orderId: 'uuid-test'
};

beforeEach(() => {
	vi.mocked(api).mockReset();
	orders.set([PENDING_ORDER_FIXTURE]);
});

describe('OrderSheet — 標記已付款 (Task 20: PATCH /orders/{id}/status, admin/api.ts)', () => {
	it('真打 PATCH /orders/{orderId}/status(真實後端 UUID，非顯示用 order_number)並更新 store', async () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		expect(pending, 'seed should contain a pending order').toBeTruthy();
		vi.mocked(api).mockImplementation(
			fakeRouter({ [`PATCH /orders/${pending!.orderId}/status`]: { id: pending!.orderId, order_number: 'DF-X', status: 'paid' } })
		);

		const { getByText } = render(OrderSheet, { props: { onClose: () => {}, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		await vi.waitFor(() => expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('paid'));
		expect(api).toHaveBeenCalledWith(`/orders/${pending!.orderId}/status`, {
			method: 'PATCH',
			body: JSON.stringify({ status: 'paid' })
		});
		// R12 Task 3:store 經桌面 applyStatusChange 套回——paidAt 取訂單日期,不再是「剛剛」。
		expect(get(orders).find((o) => o.id === pending!.id)?.paidAt).toBe(pending!.date);
	});

	it('API 失敗時不更動 store 狀態，也不關閉 sheet（不假裝成功）', async () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		vi.mocked(api).mockImplementation(
			fakeRouter({ [`PATCH /orders/${pending!.orderId}/status`]: new Error('boom') })
		);
		const onClose = vi.fn();

		const { getByText } = render(OrderSheet, { props: { onClose, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		await vi.waitFor(() => expect(api).toHaveBeenCalled());
		expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('pending');
		expect(onClose).not.toHaveBeenCalled();
	});

	/* R13 Task 5(C4) 回歸：舊碼把「並發衝突」文案掛在 409 上（判錯狀態碼——已對過
	 * 後端 update_order_status，非法轉換/並發衝突一律 400）。這裡釘住 400 →
	 * illegalTransition 分支顯示這句、store 不動、sheet 不關。 */
	it('PATCH 400（illegalTransition）→ 顯示「訂單狀態已變更…」，store 不動，sheet 不關', async () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		vi.mocked(api).mockImplementation(
			fakeRouter({ [`PATCH /orders/${pending!.orderId}/status`]: new ApiError(400, 'cannot transition order') })
		);
		const onClose = vi.fn();

		const { getByText } = render(OrderSheet, { props: { onClose, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toBe('訂單狀態已變更，請重新整理後再試。'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('pending');
		expect(onClose).not.toHaveBeenCalled();
	});

	it('未知 status(契約若擴出新值) → 降級為 neutral 徽章 + 原字串，不會炸掉(orderStatusBadge fallback)', () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		const unknownOrder: OrderRow = { ...pending!, status: 'future_status' as OrderRow['status'] };

		const { container, getByText } = render(OrderSheet, { props: { onClose: () => {}, o: unknownOrder } });

		expect(getByText('future_status')).toBeInTheDocument();
		expect(container.querySelector('.badge.neutral')).not.toBeNull();
	});
});
