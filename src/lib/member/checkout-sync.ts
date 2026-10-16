import { derived, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import type { CouponValidateResponse, OrderResponse } from '$lib/api/generated';
import { ntd } from '$lib/public/adapters';
import { subtotalOf } from '$lib/checkout-math';
import {
	createCheckoutController,
	type AppliedCoupon,
	type CheckoutController,
	type CheckoutOpenOutcome,
	type PaidSummary,
	type PlaceOrderInput
} from './checkout-controller';
import { chargeableLines } from './checkout';
import { subscriptions } from './subscriptions';
import { points } from './points';
import type { CartItem, ChargeableLine } from '$lib/cart-item';

/* ---- Checkout — 每個 surface 的結帳工廠（docs/adr/0025 §9、docs/adr/0027 §3）。desktop
 * CheckoutDialog 與 mobile/stores 各自的購物車 store 不同、下單後／開啟即要暖的 store
 * 也不同（desktop 兩者都是 [refreshSubscriptions, refreshPoints]；mobile 只有
 * [refreshPoints]），但兩者共用同一套「lines 衍生、送單、開啟即水合」組裝方式——組裝
 * 本身收在這裡，呼叫端只需注入自己的 cart 與兩份 refresh 清單。送單序列（syncCartToServer →
 * POST /orders → allSettled refreshAfterOrder → cart.clear）與套用優惠碼（applyCouponCode）
 * 都是本檔的私有函式，測試一律經 createCheckout 的 interface。 */

/** 購物車同步到後端：先 DELETE 清空 server 端購物車，再逐項 POST /cart/items（upsert）。
 *  課程項目一律送 quantity 1 — cart.updateQty 已在 store 層把課程 qty 鎖 1，
 *  這裡的夾 1 是 belt-and-suspenders：舊 session 持久化在 localStorage
 *  （dreamfly_cart_v3）的購物車仍可能帶著鎖 1 之前推上去的 qty>1 課程行。
 *  方案項目照本地 qty 送出。 */
async function syncCartToServer(items: CartItem[]): Promise<void> {
	await api('/cart', { method: 'DELETE' });
	for (const it of items) {
		await api('/cart/items', {
			method: 'POST',
			body: JSON.stringify({
				item_type: it.type === 'pass' ? 'product' : 'course',
				item_id: it.id,
				quantity: it.type === 'course' ? 1 : it.qty
			})
		});
	}
}

/**
 * 「套用」按鈕的結果機：空輸入（或只有空白）回 null——controller 據此不動任何狀態（空輸入
 * 按「套用」不顯示錯誤）。其餘呼叫 GET /coupons/{code}/validate（需登入；後端自己 trim +
 * 轉大寫比對，這裡只 trim）：命中回 `{ coupon, codeErr: '' }`（discount_cents → NT$ 經
 * ntd()）；查無（404：不存在／未啟用／已過期，後端三者不區分）與網路/未預期錯誤一視同仁，
 * 一律回 `{ coupon: null, codeErr: '優惠碼無效或已過期' }`——不另開技術性錯誤文案。
 */
async function applyCouponCode(code: string): Promise<{ coupon: AppliedCoupon | null; codeErr: string } | null> {
	if (!code.trim()) return null;
	try {
		const res = await api<CouponValidateResponse>(`/coupons/${encodeURIComponent(code.trim())}/validate`);
		return { coupon: { code: res.code, off: ntd(res.discount_cents) }, codeErr: '' };
	} catch {
		return { coupon: null, codeErr: '優惠碼無效或已過期' };
	}
}

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
 * 可計費購物車：已持有的方案不計費（chargeableLines 單一產地），lines／billable／total 只在此推導一次，
 * 購物車頁、下拉與 createCheckout 共用——預覽合計 ≡ 實際請款。
 */
export function chargeableCart(cart: Readable<CartItem[]>) {
	const lines = derived([cart, subscriptions], ([c, s]) => chargeableLines(c, s));
	const billable = derived(lines, ($lines) => new Set<CartItem>($lines));
	const total = derived(lines, ($lines) => subtotalOf($lines));
	return { lines, billable, total };
}

/**
 * 組出一個 surface 專用的 CheckoutController：`lines` 衍生自注入的 cart 與 member
 * 訂閱（chargeableLines 過濾）；送單走私有 placeOrder，afterOrder/clearCart
 * 對應注入的 refreshAfterOrder/cart.clear；`applyCouponCode` 是本檔私有、`points` 單源自
 * member 側模組。setOpen 額外在 freshCheckout 時觸發 refreshOnOpen（best-effort，
 * 失敗吞掉，沿用現值——與原本兩個 surface 各自手焊的佈線同語意）。
 */
export function createCheckout(w: CheckoutSyncDeps): CheckoutController {
	const { lines } = chargeableCart(w.cart);

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
