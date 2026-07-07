import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import type { CartItem } from './data';
import { chargeableLines } from './checkout';
import { cart } from './cart';
import { subscriptions, refreshSubscriptions } from './subscriptions';
import { refreshPoints } from './points';

/* ---- Checkout — 真訂單 API 接縫（Task 16） ----
 * 取代原本本地結算的 commitCheckout+applyOrder 組合（兩者已於 final review 移除）：
 * 金額/點數/報名/訂閱的商業規則一律以後端為準，前端只負責把「可計費項目」
 * （chargeableLines）同步過去、送出訂單、再把 subscriptions/points 從後端
 * hydrate 回 store。 */

export interface ApiOrderItem {
  id: string;
  item_type: 'product' | 'course';
  product_id: string | null;
  course_id: string | null;
  quantity: number;
  unit_price_cents: number;
}

export interface ApiOrder {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  discount_cents: number;
  coupon_code: string | null;
  points_used: number;
  points_earned: number;
  paid_at: string | null;
  created_at: string;
  items: ApiOrderItem[];
}

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

/** 送出訂單 — 先同步購物車，再 POST /orders（mock payment：成功即代表付款完成，
 *  見 integration-contract.md §1.8）。idempotencyKey 未指定時每次呼叫各自產生
 *  一把新 uuid；同一次結帳流程重試時，呼叫端（CheckoutDialog）需自行保留並重
 *  複傳入同一把 key，後端才會辨識為重放、回傳原訂單而不重複扣款/建立報名訂閱
 *  （見 §1.7）。成功後把 subscriptions/points 從後端重新 hydrate、清空本地購
 *  物車；任何失敗（400 購物車為空/優惠碼無效、409 滿班/已報名/點數不足等）一
 *  律不清空本地購物車、不 hydrate，原樣把錯誤丟給呼叫端處理（顯示 toast）。 */
export async function placeOrder(
  coupon: string,
  usePoints: boolean,
  idempotencyKey: string = crypto.randomUUID()
): Promise<ApiOrder> {
  // 只同步「可計費項目」— 與 CheckoutDialog 預覽用同一個 chargeableLines 過濾
  // （已持有的 pass 不進 server 購物車）。預覽合計跳過的項目絕不能被請款：
  // 同意的金額 ≡ 實際請款的金額，靠同一個過濾函式從建構上保證。
  await syncCartToServer(chargeableLines(get(cart), get(subscriptions)));
  const order = await api<ApiOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({ coupon_code: coupon || undefined, use_points: usePoints }),
    headers: { 'Idempotency-Key': idempotencyKey }
  });
  // 訂單此時已成立（伺服器已扣款、報名/訂閱已建立、server 端購物車已清空）—
  // 後續 hydrate 只是 best-effort 的本地同步，用 allSettled 讓其中一支網路
  // 失敗不會把「已成功的訂單」回報成失敗（呼叫序列仍是先 subscriptions 後
  // points：陣列字面量會依序同步呼叫兩個 async function 直到各自第一個 await）。
  const [subsResult, pointsResult] = await Promise.allSettled([refreshSubscriptions(), refreshPoints()]);
  if (subsResult.status === 'rejected') console.error('Failed to refresh subscriptions after checkout:', subsResult.reason);
  if (pointsResult.status === 'rejected') console.error('Failed to refresh points after checkout:', pointsResult.reason);
  cart.clear();
  return order;
}
