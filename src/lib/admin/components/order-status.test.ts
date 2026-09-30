import { describe, it, expect, vi } from 'vitest';
import type { Order } from '$lib/admin/data';
import type { OrderStatus } from '$lib/api/wire';
import { ApiError } from '$lib/api/client';
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
	return {
		id,
		member: '測試員',
		initial: '測',
		color: '#0066CC',
		item: '測試項目',
		amount: 1000,
		status,
		method: '信用卡',
		date: '06/01 00:00',
		discount: '—',
		tax: 48,
		net: 952,
		paidAt: status === 'pending' ? '—（待付款）' : '06/01 00:00',
		orderId: 'uuid-' + id
	};
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
	it('pending → paid | cancelled', () => {
		expect(legalNextStatuses('pending')).toEqual(['paid', 'cancelled']);
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
		const out = applyStatusChange(rows, 'uuid-DF-1', 'processing');
		expect(out.find((o) => o.orderId === 'uuid-DF-1')!.status).toBe('processing');
		expect(out.find((o) => o.orderId === 'uuid-DF-2')!.status).toBe('pending'); // 其餘不動
	});

	it('never mutates the input array', () => {
		const out = applyStatusChange(rows, 'uuid-DF-1', 'processing');
		expect(out).not.toBe(rows);
		expect(rows.find((o) => o.orderId === 'uuid-DF-1')!.status).toBe('paid');
	});

	it('sets paidAt to the order date for any non-pending target status (mirrors mapAdminOrder)', () => {
		const out = applyStatusChange(rows, 'uuid-DF-1', 'refunded');
		const o = out.find((x) => x.orderId === 'uuid-DF-1')!;
		expect(o.paidAt).toBe(o.date);
	});

	it('is a no-op for an unknown orderId', () => {
		const out = applyStatusChange(rows, '___nope___', 'refunded');
		expect(out.map((o) => o.status)).toEqual(rows.map((o) => o.status));
	});
});

/* changeOrderStatus — 已對過 dream_fly_backend 的 update_order_status：非法轉換
 * /並發衝突一律 400，409 只在退款/取消的點數回收餘額不足時發生，其餘（含 403）
 * 走 failed，由呼叫端翻文案。 */
describe('changeOrderStatus — PATCH /orders/{id}/status 呼叫 + 狀態碼判別', () => {
	it('200 成功 → changed{status}，status 以 server 回的為準（不硬寫 next）', async () => {
		const updateOrderStatus = vi.fn().mockResolvedValue({ status: 'processing' });
		const outcome = await changeOrderStatus('uuid-1', 'refunded', { updateOrderStatus });
		expect(updateOrderStatus).toHaveBeenCalledWith('uuid-1', 'refunded');
		expect(outcome).toEqual({ kind: 'changed', status: 'processing' });
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
