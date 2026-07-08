/* Dream Fly — 共享下單 orchestration（跨 surface，B0.4）。
 *
 * member 的 `member/checkout-sync.ts` 與 mobile 的 `mobile/stores.ts` 各自複製了一整段
 * 「同步購物車 → POST /orders → 後續刷新 → 清購物車 → 適配確認」序列（ADR 0006 真後端
 * 接線之後，商業規則已全落在後端，前端只剩這段純 wire orchestration）。本模組收斂為單一
 * 來源，命名循 lib-root checkout 家族（`checkout-math.ts`、`checkout-gate.ts`）。
 *
 * store 寫入 per-surface 注入（ADR 0003 精神：兩 surface 不共用 store，合併的只有純
 * orchestration 機制本身，store 讀寫仍由呼叫端決定）——本模組不 import 任何
 * member/mobile/admin 等 surface 的 store，改以 `lines` 參數 + `afterOrder`/`clearCart`
 * callback 注入。wire 形狀（`ApiOrderItem`/`ApiOrder`）單源自此；member/mobile 委派見
 * 各 surface adapter（後續任務）。 */

import { api } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';
import type { CartItem } from '$lib/member/data';

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

export interface OrderConfirmation {
  total: number; // NT$ 整數
  earned: number; // 回饋點數
  ptRedeem: number; // 點數折抵
  orderNumber: string;
  hasCourse: boolean; // 訂單內含課程項
  hasPass: boolean; // 訂單內含方案項
  raw: ApiOrder; // 原始 wire 物件，呼叫端要 raw 欄位時用
}

/** 送出訂單 — 先同步購物車，再 POST /orders（mock payment：成功即代表付款完成，
 *  見 integration-contract.md §1.8），成功後跑呼叫端提供的 `afterOrder` 副作用
 *  （原本焊死在 member placeOrder 裡的 refreshSubscriptions/refreshPoints，現在
 *  改由呼叫端注入），settle 後才清購物車、組裝確認物件回傳。
 *
 *  idempotencyKey 未指定時每次呼叫各自產生一把新 uuid；同一次結帳流程重試時，
 *  呼叫端需自行保留並重複傳入同一把 key，後端才會辨識為重放、回傳原訂單而不
 *  重複扣款/建立報名訂閱。任何失敗（syncCartToServer 或 POST /orders）一律原樣
 *  拋出、不呼叫 afterOrder、不清購物車，讓呼叫端顯示錯誤並可安全重試。 */
export async function submitOrder(
  lines: CartItem[],
  opts: {
    coupon: string;
    usePoints: boolean;
    idempotencyKey?: string; // 省略時預設 crypto.randomUUID()
    afterOrder?: () => Array<Promise<unknown>>; // 依序啟動、整體 allSettled、逐筆失敗 console.error
    clearCart?: () => void; // afterOrder settle 後才呼叫
  }
): Promise<OrderConfirmation> {
  await syncCartToServer(lines);

  const idempotencyKey = opts.idempotencyKey ?? crypto.randomUUID();
  const order = await api<ApiOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({ coupon_code: opts.coupon || undefined, use_points: opts.usePoints }),
    headers: { 'Idempotency-Key': idempotencyKey }
  });

  // 訂單此時已成立（伺服器已扣款、報名/訂閱已建立、server 端購物車已清空）——
  // 後續副作用只是 best-effort 的本地同步，用 allSettled 讓其中一支失敗不會把
  // 「已成功的訂單」回報成失敗。
  if (opts.afterOrder) {
    const results = await Promise.allSettled(opts.afterOrder());
    for (const result of results) {
      if (result.status === 'rejected') console.error('Failed to refresh after checkout:', result.reason);
    }
  }
  opts.clearCart?.();

  const hasCourse = order.items.some((i) => i.item_type === 'course');
  const hasPass = order.items.some((i) => i.item_type === 'product');
  return {
    total: ntd(order.total_cents), // 本模組只在 submit 結果邊界把 total_cents 以共用的 `ntd()` 換算為 NT$ 整數（`ntd` 單一定義見 public/adapters，ADR 0007）
    earned: order.points_earned,
    ptRedeem: order.points_used,
    orderNumber: order.order_number,
    hasCourse,
    hasPass,
    raw: order
  };
}
