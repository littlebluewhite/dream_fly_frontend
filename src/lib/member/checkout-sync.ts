import { get } from 'svelte/store';
import { submitOrder, type OrderConfirmation, type PaymentMethod } from '$lib/checkout-order';
import { chargeableLines } from './checkout';
import { cart } from './cart';
import { subscriptions, refreshSubscriptions } from './subscriptions';
import { refreshPoints } from './points';

/* ---- Checkout — 真訂單 API 接縫（Task 16；Task 10/C4 收斂進 `$lib/checkout-order`
 * 共用 orchestration，本檔改為委派 + re-export） ----
 * 金額/點數/報名/訂閱的商業規則一律以後端為準，前端只負責把「可計費項目」
 * （chargeableLines）同步過去、送出訂單、再把 subscriptions/points 從後端
 * hydrate 回 store——實際的同步/送單序列現在單源自 `$lib/checkout-order` 的
 * `submitOrder`，本檔只注入 member 專屬的 store 讀寫。 */

export { syncCartToServer } from '$lib/checkout-order';
export type { ApiOrderItem, ApiOrder, PaymentMethod } from '$lib/checkout-order';

/** 送出訂單 — 委派 `$lib/checkout-order` 的 `submitOrder`：本檔只負責注入 member
 *  專屬的 store 操作——lines 用現行購物車的可計費項目（chargeableLines）、
 *  afterOrder 對應現行的 refreshSubscriptions()/refreshPoints() promise 陣列、
 *  clearCart 對應現行的 cart.clear()。呼叫序列（sync→POST /orders→hydrate→
 *  clear）與失敗語意（任何失敗原樣拋出、不 hydrate、不清購物車）不變；
 *  idempotencyKey 未指定時交由 submitOrder 產生新 uuid。paymentMethod
 *  （Round 4 Task P4-B1）由 CheckoutDialog 的付款方式單選傳入，未帶時沿用
 *  credit_card 預設。回傳值改為 `OrderConfirmation`（計畫核可的行為變更——
 *  原本回傳 raw ApiOrder；原始物件仍可經 `.raw` 取得）。 */
export async function placeOrder(
  coupon: string,
  usePoints: boolean,
  idempotencyKey?: string,
  paymentMethod: PaymentMethod = 'credit_card'
): Promise<OrderConfirmation> {
  return submitOrder(chargeableLines(get(cart), get(subscriptions)), {
    coupon,
    usePoints,
    paymentMethod,
    idempotencyKey,
    afterOrder: () => [refreshSubscriptions(), refreshPoints()],
    clearCart: () => cart.clear()
  });
}
