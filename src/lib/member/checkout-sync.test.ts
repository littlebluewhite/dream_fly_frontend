/* Dream Fly — member 結帳工廠（createCheckout，Task 9(架構深化 R15·F-5)）單測。
 *
 * 覆蓋兩件事：①送單呼叫序列（原本 checkout-api.test.ts 的 placeOrder 兩個 describe
 * 已搬進本檔並改走 createCheckout；只替換 $lib/api/client 的 api()，ApiError 用回
 * 真實類別）；②surface adapter 這層自己的組裝——lines 衍生自注入的 cart + member
 * 訂閱（chargeableLines 過濾已持有的 pass）、setOpen 在 freshCheckout 時觸發注入的
 * refreshOnOpen（best-effort，失敗吞掉）。*/

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { createCart } from '$lib/cart';
import type { ApiOrder } from '$lib/checkout-order';
import { createCheckout } from './checkout-sync';
import { subscriptions, refreshSubscriptions } from './subscriptions';
import { points, refreshPoints } from './points';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const SAMPLE_ORDER: ApiOrder = {
	id: 'order-1',
	order_number: 'DF-20260704ABCD1234',
	status: 'paid',
	total_cents: 470000,
	discount_cents: 10000,
	coupon_code: null,
	points_used: 0,
	points_earned: 235,
	paid_at: '2026-06-22T00:00:00Z',
	created_at: '2026-06-22T00:00:00Z',
	items: [{ id: 'oi-1', item_type: 'course', product_id: null, course_id: 'course-uuid-9', quantity: 1, unit_price_cents: 480000 }]
};

/** cart 呼叫預設：未覆寫時 DELETE /cart 與 POST /cart/items 回 undefined（同
 *  checkout-api.test.ts 既有慣例）。 */
const CART_DEFAULTS: Record<string, unknown> = { 'DELETE /cart': undefined, 'POST /cart/items': undefined };

beforeEach(() => {
	subscriptions.set([]);
	points.set(0);
	vi.mocked(api).mockReset();
});

describe('createCheckout — 送單呼叫序列（sync → orders → hydrate → clear）', () => {
	it('完整序列：DELETE /cart → POST /cart/items ×N（課程 qty 夾 1）→ POST /orders 帶 Idempotency-Key → GET subscriptions/points → 本地購物車清空', async () => {
		const cart = createCart();
		cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
		cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
		vi.mocked(api).mockImplementation(
			fakeRouter(
				{
					'POST /orders': SAMPLE_ORDER,
					'GET /subscriptions/me': [],
					'GET /points/me': { balance: 235 }
				},
				CART_DEFAULTS
			)
		);

		const checkout = createCheckout({ cart, refreshAfterOrder: [refreshSubscriptions, refreshPoints], refreshOnOpen: [] });
		const outcome = await checkout.confirmPay();

		expect(api).toHaveBeenNthCalledWith(1, '/cart', { method: 'DELETE' });
		expect(api).toHaveBeenNthCalledWith(2, '/cart/items', {
			method: 'POST',
			body: JSON.stringify({ item_type: 'course', item_id: 'course-uuid-9', quantity: 1 })
		});
		expect(api).toHaveBeenNthCalledWith(3, '/cart/items', {
			method: 'POST',
			body: JSON.stringify({ item_type: 'product', item_id: 'pass-uuid-9', quantity: 1 })
		});
		expect(api).toHaveBeenNthCalledWith(4, '/orders', {
			method: 'POST',
			body: JSON.stringify({ use_points: false, payment_method: 'credit_card' }),
			headers: { 'Idempotency-Key': expect.any(String) }
		});
		expect(api).toHaveBeenNthCalledWith(5, '/subscriptions/me');
		expect(api).toHaveBeenNthCalledWith(6, '/points/me');
		expect(outcome.kind).toBe('orderPlaced');
		if (outcome.kind === 'orderPlaced') {
			expect(outcome.paid.orderNumber).toBe('DF-20260704ABCD1234');
			expect(outcome.paid.total).toBe(4700); // ntd(470000) 換算後的 NT$ 整數
		}
		expect(get(cart)).toEqual([]); // 注入的 clearCart 真的清空這顆 cart
		expect(get(points)).toBe(235); // 注入的 refreshAfterOrder 真的水合了真點數
	});

	it('已持有的 pass 不同步到 server — lines 只送 chargeableLines（同意金額 ≡ 請款金額）', async () => {
		subscriptions.set([{ id: 'pass-uuid-9', name: '方案', since: '2026-06-01', price: 3000 }]);
		const cart = createCart();
		cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
		cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /orders': SAMPLE_ORDER, 'GET /subscriptions/me': [], 'GET /points/me': { balance: 0 } }, CART_DEFAULTS)
		);

		const checkout = createCheckout({ cart, refreshAfterOrder: [refreshSubscriptions, refreshPoints], refreshOnOpen: [] });
		await checkout.confirmPay();

		const itemPosts = vi.mocked(api).mock.calls.filter(([p, i]) => p === '/cart/items' && (i as RequestInit)?.method === 'POST');
		expect(itemPosts).toHaveLength(1); // 只有課程；已持有的 pass 被排除
		expect((itemPosts[0][1] as RequestInit).body).toBe(
			JSON.stringify({ item_type: 'course', item_id: 'course-uuid-9', quantity: 1 })
		);
	});
});

describe('createCheckout — 失敗路徑', () => {
	it('POST /orders 409（滿班）→ outcome orderFailed（原始拋出物）；本地購物車不清空；不 hydrate subscriptions/points', async () => {
		const cart = createCart();
		cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': new ApiError(409, 'course is full') }, CART_DEFAULTS));

		const checkout = createCheckout({ cart, refreshAfterOrder: [refreshSubscriptions, refreshPoints], refreshOnOpen: [] });
		const outcome = await checkout.confirmPay();

		expect(outcome.kind).toBe('orderFailed');
		if (outcome.kind === 'orderFailed') {
			expect(outcome.error).toBeInstanceOf(ApiError);
			expect((outcome.error as ApiError).status).toBe(409);
		}
		expect(get(cart)).toHaveLength(1); // 未清空
		expect(api).not.toHaveBeenCalledWith('/subscriptions/me');
		expect(api).not.toHaveBeenCalledWith('/points/me');
	});
});

describe('createCheckout — setOpen 的 refreshOnOpen（開啟即水合）', () => {
	it('freshCheckout（閉→開邊沿、非飛行中）觸發注入的 refreshOnOpen；noop 不觸發', async () => {
		const cart = createCart();
		const onOpenA = vi.fn().mockResolvedValue(undefined);
		const onOpenB = vi.fn().mockResolvedValue(undefined);
		const checkout = createCheckout({ cart, refreshAfterOrder: [], refreshOnOpen: [onOpenA, onOpenB] });

		expect(checkout.setOpen(true)).toEqual({ kind: 'freshCheckout' });
		await Promise.resolve(); // fire-and-forget，讓 refreshOnOpen 的 microtask 跑完
		expect(onOpenA).toHaveBeenCalledTimes(1);
		expect(onOpenB).toHaveBeenCalledTimes(1);

		expect(checkout.setOpen(true)).toEqual({ kind: 'noop' }); // 開→開無邊沿
		await Promise.resolve();
		expect(onOpenA).toHaveBeenCalledTimes(1); // 不再觸發
	});

	it('refreshOnOpen 失敗 best-effort 吞掉——setOpen 本身不拋出', () => {
		const cart = createCart();
		const failing = vi.fn().mockRejectedValue(new Error('network down'));
		const checkout = createCheckout({ cart, refreshAfterOrder: [], refreshOnOpen: [failing] });

		expect(() => checkout.setOpen(true)).not.toThrow();
	});
});
