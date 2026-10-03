/* Dream Fly — 結帳 wire 層（跨 surface）：付款方式值域與購物車同步。
 *
 * 送單序列（同步購物車 → POST /orders → 後續刷新 → 清購物車）已收進 member 的
 * `createCheckout`（`member/checkout-sync.ts`）的私有 placeOrder，本模組只留兩個
 * 兩 surface 都要用的東西：`PaymentMethod` 值域與 `syncCartToServer`（訂單 wire 形狀
 * 自 W-6 起是後端產生型別 `OrderResponse`，見 $lib/api/generated）。本模組不 import
 * 任何 surface 的 store（ADR 0003 精神）。 */

import { api } from '$lib/api/client';
import type { CartItem } from '$lib/cart-item';

/** 付款方式（Round 4 Task P4-B1；integration-contract.md §1.8/§3.10）值域——純應用層
 *  值域，非 DB enum。不帶時後端預設 credit_card；帶入值域外字串回 422。目前仍是
 *  模擬金流（見 §1.8），這裡只是把使用者的選擇如實送出，不影響下單流程本身。 */
export type PaymentMethod = 'credit_card' | 'line_pay' | 'atm' | 'jkopay' | 'cash';

/** 購物車同步到後端：先 DELETE 清空 server 端購物車，再逐項 POST /cart/items（upsert）。
 *  課程項目一律送 quantity 1 — cart.updateQty 已在 store 層把課程 qty 鎖 1，
 *  這裡的夾 1 是 belt-and-suspenders：舊 session 持久化在 localStorage
 *  （dreamfly_cart_v3）的購物車仍可能帶著鎖 1 之前推上去的 qty>1 課程行。
 *  方案項目照本地 qty 送出。 */
export async function syncCartToServer(items: CartItem[]): Promise<void> {
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
