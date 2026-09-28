import { derived, type Readable } from 'svelte/store';
import { submitOrder } from '$lib/checkout-order';
import { createCheckoutController, type CheckoutController, type CheckoutOpenOutcome } from './checkout-controller';
import { chargeableLines, applyCouponCode } from './checkout';
import { subscriptions } from './subscriptions';
import { points } from './points';
import type { CartItem } from '$lib/cart-item';

/* ---- Checkout — 每個 surface 的結帳工廠（Task 9(R15·F-5)：取代原本焊死在本檔的
 * member 專屬 `placeOrder`）。desktop CheckoutDialog 與 mobile/stores 各自的購物車
 * store 不同、下單後／開啟即要暖的 store 也不同（desktop 兩者都是
 * [refreshSubscriptions, refreshPoints]；mobile 只有 [refreshPoints]），但兩者共用
 * 同一套「lines 衍生、送單委派 submitOrder、開啟即水合」組裝方式——組裝本身收進這裡，
 * 呼叫端只需注入自己的 cart 與兩份 refresh 清單。 */

export interface CheckoutSyncDeps {
	cart: Readable<CartItem[]> & { clear(): void };
	/** 下單成功後要跑的 best-effort 副作用（submitOrder 的 afterOrder；整體
	 *  allSettled，逐筆失敗只 console.error，不影響已成立的訂單）。 */
	refreshAfterOrder: ReadonlyArray<() => Promise<unknown>>;
	/** freshCheckout（閉→開邊沿且非付款飛行中）時要跑的水合（best-effort，
	 *  失敗沿用現值）。 */
	refreshOnOpen: ReadonlyArray<() => Promise<unknown>>;
}

/**
 * 組出一個 surface 專用的 CheckoutController：`lines` 衍生自注入的 cart 與 member
 * 訂閱（chargeableLines 過濾）；`placeOrder` 委派 `submitOrder`，afterOrder/clearCart
 * 對應注入的 refreshAfterOrder/cart.clear；`applyCouponCode`／`points` 單源自
 * member 側模組。setOpen 額外在 freshCheckout 時觸發 refreshOnOpen（best-effort，
 * 失敗吞掉，沿用現值——與原本兩個 surface 各自手焊的佈線同語意）。
 */
export function createCheckout(w: CheckoutSyncDeps): CheckoutController {
	const lines = derived([w.cart, subscriptions], ([c, s]) => chargeableLines(c, s));

	const controller = createCheckoutController({
		placeOrder: (orderLines, order) =>
			submitOrder(orderLines, {
				coupon: order.coupon,
				usePoints: order.usePoints,
				idempotencyKey: order.idempotencyKey,
				paymentMethod: order.paymentMethod,
				afterOrder: () => w.refreshAfterOrder.map((fn) => fn()),
				clearCart: () => w.cart.clear()
			}),
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
