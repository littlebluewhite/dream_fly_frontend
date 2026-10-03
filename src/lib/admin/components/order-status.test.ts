import { describe, it, expect, vi } from 'vitest';
import type { Order } from '$lib/admin/data';
import type { OrderStatus } from '$lib/api/wire';
import { ApiError } from '$lib/api/client';
import { adminOrderSummary, orderResponse } from '$lib/testing/wire-fixtures';
import { mapAdminOrder } from '$lib/admin/api';
import {
	legalNextStatuses,
	applyStatusChange,
	isRevenueStatus,
	revenueTotal,
	changeOrderStatus
} from './order-status';

/* R13 Task 5(C4)：LEGAL_NEXT/legalNextStatuses/applyStatusChange/paidRevenue
 * 原樣搬自 orders-filter.ts（fixture 逐字照搬，行為不變）；paidRevenue 改名
 * revenueTotal 並改按 isRevenueStatus 加總（新增的 processing/completed 兩態）。 */
function makeOrder(status: OrderStatus, id: string): Order {
	return mapAdminOrder(
		adminOrderSummary({
			id: 'uuid-' + id,
			order_number: id,
			status,
			total_cents: 100000,
			paid_at: status === 'pending' ? null : '2026-06-01T00:00:00Z'
		}),
		0
	);
}

describe('isRevenueStatus — 同後端 OrderStatus::is_revenue（orders/model.rs）', () => {
	it('paid/processing/completed 計入營收', () => {
		expect(isRevenueStatus('paid')).toBe(true);
		expect(isRevenueStatus('processing')).toBe(true);
		expect(isRevenueStatus('completed')).toBe(true);
	});

	it('pending/cancelled/refunded 不計入營收', () => {
		expect(isRevenueStatus('pending')).toBe(false);
		expect(isRevenueStatus('cancelled')).toBe(false);
		expect(isRevenueStatus('refunded')).toBe(false);
	});
});

describe('revenueTotal — 按 isRevenueStatus 加總（取代 paidRevenue，含 processing/completed）', () => {
	it('sums amount over paid + processing + completed only', () => {
		const rows: Order[] = [
			makeOrder('paid', 'DF-1'),
			makeOrder('processing', 'DF-2'),
			makeOrder('completed', 'DF-3'),
			makeOrder('pending', 'DF-4'),
			makeOrder('cancelled', 'DF-5'),
			makeOrder('refunded', 'DF-6')
		];
		expect(revenueTotal(rows)).toBe(3000); // 三筆各 1000
	});
});

describe('legalNextStatuses — 契約 §3.10 狀態機的合法下一狀態', () => {
	it('pending → cancelled only（後端 BE-3 拒絕待付款→已付款）', () => {
		expect(legalNextStatuses('pending')).toEqual(['cancelled']);
	});

	it('paid → processing | refunded | cancelled', () => {
		expect(legalNextStatuses('paid')).toEqual(['processing', 'refunded', 'cancelled']);
	});

	it('processing → completed | refunded', () => {
		expect(legalNextStatuses('processing')).toEqual(['completed', 'refunded']);
	});

	it('completed → refunded only', () => {
		expect(legalNextStatuses('completed')).toEqual(['refunded']);
	});

	it('cancelled/refunded are terminal (no legal next state to offer in the UI)', () => {
		expect(legalNextStatuses('cancelled')).toEqual([]);
		expect(legalNextStatuses('refunded')).toEqual([]);
	});
});

describe('applyStatusChange — PATCH /orders/{id}/status 成功後套進本地working copy', () => {
	const rows: Order[] = [
		makeOrder('paid', 'DF-1'),
		makeOrder('pending', 'DF-2')
	];

	it('matches by orderId (真實後端 UUID)，不是顯示用的 id (order_number)', () => {
		const out = applyStatusChange(rows, 'uuid-DF-1', 'processing', '2026-06-01T00:00:00Z');
		expect(out.find((o) => o.orderId === 'uuid-DF-1')!.status).toBe('processing');
		expect(out.find((o) => o.orderId === 'uuid-DF-2')!.status).toBe('pending'); // 其餘不動
	});

	it('never mutates the input array', () => {
		const out = applyStatusChange(rows, 'uuid-DF-1', 'processing', '2026-06-01T00:00:00Z');
		expect(out).not.toBe(rows);
		expect(rows.find((o) => o.orderId === 'uuid-DF-1')!.status).toBe('paid');
	});

	it('paidAt 取回應的 paid_at（退款後仍保留原收款時間），不是訂單日期', () => {
		const out = applyStatusChange(rows, 'uuid-DF-1', 'refunded', '2026-06-03T08:00:00Z');
		expect(out.find((x) => x.orderId === 'uuid-DF-1')!.paidAt).toBe('2026-06-03');
	});

	it('回應 paid_at 為 null → 依新狀態顯示佔位', () => {
		const out = applyStatusChange(rows, 'uuid-DF-2', 'cancelled', null);
		expect(out.find((x) => x.orderId === 'uuid-DF-2')!.paidAt).toBe('—');
	});

	it('is a no-op for an unknown orderId', () => {
		const out = applyStatusChange(rows, '___nope___', 'refunded', null);
		expect(out).toEqual(rows);
	});
});

/* changeOrderStatus — 已對過 dream_fly_backend 的 update_order_status：非法轉換
 * /並發衝突一律 400，409 只在退款/取消的點數回收餘額不足時發生，其餘（含 403）
 * 走 failed，由呼叫端翻文案。 */
describe('changeOrderStatus — PATCH /orders/{id}/status 呼叫 + 狀態碼判別', () => {
	it('200 成功 → changed{status, paidAt}，兩者皆以 server 回的為準（不硬寫 next）', async () => {
		const updateOrderStatus = vi.fn().mockResolvedValue(orderResponse({ status: 'processing', paid_at: '2026-06-02T00:00:00Z' }));
		const outcome = await changeOrderStatus('uuid-1', 'refunded', { updateOrderStatus });
		expect(updateOrderStatus).toHaveBeenCalledWith('uuid-1', 'refunded');
		expect(outcome).toEqual({ kind: 'changed', status: 'processing', paidAt: '2026-06-02T00:00:00Z' });
	});

	it('400 → illegalTransition（非法轉換／並發衝突）', async () => {
		const updateOrderStatus = vi.fn().mockRejectedValue(new ApiError(400, 'cannot transition order'));
		const outcome = await changeOrderStatus('uuid-1', 'refunded', { updateOrderStatus });
		expect(outcome).toEqual({ kind: 'illegalTransition' });
	});

	it('409 → pointsShortfall（點數不足，退款/取消的補償路徑）', async () => {
		const updateOrderStatus = vi.fn().mockRejectedValue(new ApiError(409, '點數不足'));
		const outcome = await changeOrderStatus('uuid-1', 'cancelled', { updateOrderStatus });
		expect(outcome).toEqual({ kind: 'pointsShortfall' });
	});

	it('403 → failed，原始 error 原樣回傳', async () => {
		const error = new ApiError(403, 'forbidden');
		const updateOrderStatus = vi.fn().mockRejectedValue(error);
		const outcome = await changeOrderStatus('uuid-1', 'paid', { updateOrderStatus });
		expect(outcome).toEqual({ kind: 'failed', error });
	});

	it('非 ApiError（連線問題等）→ failed，原始 error 原樣回傳', async () => {
		const error = new Error('network');
		const updateOrderStatus = vi.fn().mockRejectedValue(error);
		const outcome = await changeOrderStatus('uuid-1', 'paid', { updateOrderStatus });
		expect(outcome).toEqual({ kind: 'failed', error });
	});
});
