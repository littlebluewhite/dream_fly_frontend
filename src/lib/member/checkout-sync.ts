import { derived, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import { syncCartToServer } from '$lib/checkout-order';
import type { OrderResponse } from '$lib/api/generated';
import { ntd } from '$lib/public/adapters';
import {
	createCheckoutController,
	type CheckoutController,
	type CheckoutOpenOutcome,
	type PaidSummary,
	type PlaceOrderInput
} from './checkout-controller';
import { chargeableLines, applyCouponCode } from './checkout';
import { subscriptions } from './subscriptions';
import { points } from './points';
import type { CartItem, ChargeableLine } from '$lib/cart-item';

/* ---- Checkout — 每個 surface 的結帳工廠（docs/adr/0025 §9、docs/adr/0027 §3）。desktop
 * CheckoutDialog 與 mobile/stores 各自的購物車 store 不同、下單後／開啟即要暖的 store
 * 也不同（desktop 兩者都是 [refreshSubscriptions, refreshPoints]；mobile 只有
 * [refreshPoints]），但兩者共用同一套「lines 衍生、送單、開啟即水合」組裝方式——組裝
 * 本身收在這裡，呼叫端只需注入自己的 cart 與兩份 refresh 清單。送單序列（sync → POST
 * /orders → allSettled refreshAfterOrder → cart.clear）是本檔的私有 placeOrder。 */

export interface CheckoutSyncDeps {
	cart: Readable<CartItem[]> & { clear(): void };
	/** 下單成功後要跑的 best-effort 副作用（整體 allSettled，逐筆失敗只
	 *  console.error，不影響已成立的訂單）。 */
	refreshAfterOrder: ReadonlyArray<() => Promise<unknown>>;
	/** freshCheckout（閉→開邊沿且非付款飛行中）時要跑的水合（best-effort，
	 *  失敗沿用現值）。 */
	refreshOnOpen: ReadonlyArray<() => Promise<unknown>>;
}

/**
 * 組出一個 surface 專用的 CheckoutController：`lines` 衍生自注入的 cart 與 member
 * 訂閱（chargeableLines 過濾）；送單走私有 placeOrder，afterOrder/clearCart
 * 對應注入的 refreshAfterOrder/cart.clear；`applyCouponCode`／`points` 單源自
 * member 側模組。setOpen 額外在 freshCheckout 時觸發 refreshOnOpen（best-effort，
 * 失敗吞掉，沿用現值——與原本兩個 surface 各自手焊的佈線同語意）。
 */
export function createCheckout(w: CheckoutSyncDeps): CheckoutController {
	const lines = derived([w.cart, subscriptions], ([c, s]) => chargeableLines(c, s));

	/** 同步購物車 → POST /orders（mock payment：成功即代表付款完成，見
	 *  integration-contract.md §1.8）→ 刷新 → 清購物車。idempotencyKey 由 controller
	 *  持有（失敗重試沿用同一把，後端才會辨識為重放而不重複扣款）。任何失敗（sync 或
	 *  POST）原樣拋出、不刷新、不清購物車，讓呼叫端顯示錯誤並可安全重試。lines 只收
	 *  ChargeableLine[]——與預覽同一產地，型別強制「預覽合計 ≡ 實際請款」。 */
	async function placeOrder(orderLines: ChargeableLine[], order: PlaceOrderInput): Promise<PaidSummary> {
		await syncCartToServer(orderLines);
		const placed = await api<OrderResponse>('/orders', {
			method: 'POST',
			body: JSON.stringify({
				coupon_code: order.coupon || undefined,
				use_points: order.usePoints,
				payment_method: order.paymentMethod
			}),
			headers: { 'Idempotency-Key': order.idempotencyKey }
		});

		// 訂單此時已成立（伺服器已扣款、報名/訂閱已建立、server 端購物車已清空）——
		// 後續刷新只是 best-effort 的本地同步，allSettled 讓其中一支失敗不會把
		// 「已成功的訂單」回報成失敗。
		const results = await Promise.allSettled(w.refreshAfterOrder.map((fn) => fn()));
		for (const result of results) {
			if (result.status === 'rejected') console.error('Failed to refresh after checkout:', result.reason);
		}
		w.cart.clear();

		return {
			total: ntd(placed.total_cents), // total_cents → NT$ 整數經共用 `ntd()`（單一定義見 public/adapters，ADR 0007）
			earned: placed.points_earned,
			ptRedeem: placed.points_used,
			hasCourse: placed.items.some((i) => i.item_type === 'course'),
			hasPass: placed.items.some((i) => i.item_type === 'product'),
			orderNumber: placed.order_number
		};
	}

	const controller = createCheckoutController({
		placeOrder,
		applyCouponCode,
		lines,
		points
	});

	return {
		...controller,
		setOpen(open: boolean): CheckoutOpenOutcome {
			const outcome = controller.setOpen(open);
			if (outcome.kind === 'freshCheckout') {
				for (const fn of w.refreshOnOpen) void fn().catch(() => {});
			}
			return outcome;
		}
	};
}
