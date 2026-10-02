/* Dream Fly — member 結帳工廠（createCheckout，Task 9(架構深化 R15·F-5)）單測。
 *
 * 覆蓋兩件事：①送單呼叫序列（原本 checkout-api.test.ts 的 placeOrder 兩個 describe
 * 已搬進本檔並改走 createCheckout；只替換 $lib/api/client 的 api()，ApiError 用回
 * 真實類別）；②surface adapter 這層自己的組裝——lines 衍生自注入的 cart + member
 * 訂閱（chargeableLines 過濾已持有的 pass）、setOpen 在 freshCheckout 時觸發注入的
 * refreshOnOpen（best-effort，失敗吞掉）。*/

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('createCheckout — 送單內容（confirmPay 經 placeOrder）', () => {
	const courseCart = () => {
		const cart = createCart();
		cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
		return cart;
	};

	it('未套優惠碼 → coupon_code 整個欄位省略；未指定付款方式預設 credit_card；Idempotency-Key 為 uuid', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));

		const checkout = createCheckout({ cart: courseCart(), refreshAfterOrder: [], refreshOnOpen: [] });
		checkout.form.update((f) => ({ ...f, usePoints: true }));
		await checkout.confirmPay();

		const call = vi.mocked(api).mock.calls.find(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
		const init = call?.[1] as { body: string; headers: Record<string, string> };
		expect(init.body).toBe(JSON.stringify({ use_points: true, payment_method: 'credit_card' }));
		expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('套用優惠碼＋指定 line_pay → POST /orders body 帶 coupon_code 與 payment_method: line_pay', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter(
				{ 'POST /orders': SAMPLE_ORDER, 'GET /coupons/DREAMFLY100/validate': { code: 'DREAMFLY100', discount_cents: 10000 } },
				CART_DEFAULTS
			)
		);

		const checkout = createCheckout({ cart: courseCart(), refreshAfterOrder: [], refreshOnOpen: [] });
		checkout.form.update((f) => ({ ...f, code: 'DREAMFLY100', paymentMethod: 'line_pay' }));
		await checkout.applyCode();
		await checkout.confirmPay();

		expect(api).toHaveBeenCalledWith('/orders', {
			method: 'POST',
			body: JSON.stringify({ coupon_code: 'DREAMFLY100', use_points: false, payment_method: 'line_pay' }),
			headers: { 'Idempotency-Key': expect.any(String) }
		});
	});

	it('成交快照各欄位取自後端回應（hasCourse/hasPass 由 items 推得）', async () => {
		const order: ApiOrder = {
			...SAMPLE_ORDER,
			points_used: 100,
			items: [
				...SAMPLE_ORDER.items,
				{ id: 'oi-2', item_type: 'product', product_id: 'pass-uuid-9', course_id: null, quantity: 1, unit_price_cents: 300000 }
			]
		};
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': order }, CART_DEFAULTS));

		const checkout = createCheckout({ cart: courseCart(), refreshAfterOrder: [], refreshOnOpen: [] });
		const outcome = await checkout.confirmPay();

		expect(outcome).toEqual({
			kind: 'orderPlaced',
			paid: { total: 4700, earned: 235, ptRedeem: 100, hasCourse: true, hasPass: true, orderNumber: 'DF-20260704ABCD1234' }
		});
	});

	it('同步購物車失敗（DELETE /cart 出錯）→ orderFailed、不打 POST /orders、不清購物車', async () => {
		const cart = courseCart();
		vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /cart': new ApiError(500, 'internal error') }, CART_DEFAULTS));

		const checkout = createCheckout({ cart, refreshAfterOrder: [], refreshOnOpen: [] });
		const outcome = await checkout.confirmPay();

		expect(outcome.kind).toBe('orderFailed');
		expect(api).toHaveBeenCalledTimes(1); // 只有 DELETE /cart
		expect(get(cart)).toHaveLength(1);
	});
});

describe('createCheckout — refreshAfterOrder 部分失敗', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('其中一支 reject：訂單仍視為成功、購物車仍清空、console.error 記一筆', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));
		const cart = createCart();
		cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });

		const checkout = createCheckout({
			cart,
			refreshAfterOrder: [() => Promise.resolve(), () => Promise.reject(new Error('refresh failed'))],
			refreshOnOpen: []
		});
		const outcome = await checkout.confirmPay();

		expect(outcome.kind).toBe('orderPlaced');
		expect(get(cart)).toEqual([]);
		expect(errSpy).toHaveBeenCalledTimes(1);
		expect(errSpy).toHaveBeenCalledWith('Failed to refresh after checkout:', expect.any(Error));
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
