/* Dream Fly — member 結帳前端邏輯（真 API 時代）。
 *
 * 三個成員：
 *  - chargeableLines（純）：預覽與 placeOrder 購物車同步共用的「跳過已持有 pass」過濾。
 *  - validateCoupon（API）：GET /coupons/{code}/validate，404 → null。
 *  - orderErrorMessage（純）：後端結帳錯誤字串 → 繁中 toast 文案。
 *
 * Task 16 前的本地結算 commitCheckout / CheckoutContext / CheckoutResult 已移除
 * （final review 裁定）：金額/點數/報名/訂閱的商業規則以後端為準（stores.ts 的
 * placeOrder），前端不再平行維護一份會漂移的副本。 */

import type { CartItem, ChargeableLine } from '$lib/cart-item';
import { api, ApiError } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';

/* ─── chargeableLines ─────────────────────────────────────────── */

/**
 * 過濾出「可計費項目」：已持有的 pass 是 no-op，不計費、不贈點。回傳 branded 的
 * `ChargeableLine[]`（見 $lib/cart-item）——本函式是全站唯一的 brand 產地。預覽
 * （checkoutMath）與請款（submitOrder，經 syncCartToServer 推上 server 購物車）
 * 兩個終點都只收 `ChargeableLine[]`，「預覽合計 ≡ 實際請款」不再靠呼叫端記憶、
 * 改由型別強制:預覽跳過的項目不可能繞過本產地被送進 server 購物車。
 */
export function chargeableLines(cart: CartItem[], subs: { id: string }[]): ChargeableLine[] {
  const subscribedIds = new Set(subs.map((s) => s.id));
  // 唯一受祝福的 brand 斷言:過濾後留下的每一行都已滿足「可計費」的執行期條件
  // （非已持有的 pass），brand 是 nominal 標記、無結構表徵，`satisfies`／顯式型別
  // 註記／`as const` 都產生不出它（CartItem 結構上不帶 CHARGEABLE symbol）。ADR
  // 0012 §3 對整段 `as` 的禁令，針對的是「遮蔽字面逐一驗證」的字面陣列斷言;本處
  // 是 nominal brand 的單一產地斷言、不遮蔽任何字面（`.filter` 述詞本身即執行期
  // 保證），屬該紀律承認的必要例外。消費端從此只收 ChargeableLine[]，繞不過此產地。
  return cart.filter((c) => !(c.type === 'pass' && subscribedIds.has(c.id))) as ChargeableLine[];
}

/* ─── validateCoupon — 真實 API 驗證（本地查表版 lookupCoupon 已退役；CartSheet 是最後
 * 一個呼叫端，已隨 Task 19 收尾改真 API，查表不再保留）── */

export interface CouponValidateResponse {
  code: string;
  discount_cents: number;
}

/**
 * 呼叫 GET /coupons/{code}/validate（需登入）。後端本身就會 trim + 轉大寫比對
 * （見 coupons::repository::normalize_code），這裡只 trim，不用再自己轉大寫。
 * 404（不存在／未啟用／已過期，後端三者不區分）→ null；其餘錯誤（網路、5xx 等）原樣拋出，
 * 交由呼叫端決定怎麼呈現。discount_cents → NT$ 一律經 ntd()（全前端唯一轉換點）。
 */
export async function validateCoupon(code: string): Promise<{ code: string; off: number } | null> {
  try {
    const res = await api<CouponValidateResponse>(`/coupons/${encodeURIComponent(code.trim())}/validate`);
    return { code: res.code, off: ntd(res.discount_cents) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/* ─── orderErrorMessage — 結帳錯誤 → 繁中 toast 文案 ─────────────── */

/** 已知的後端結帳錯誤（integration-contract.md §3.10；子字串逐字對照
 *  orders/enrolments/points service 原始碼的英文錯誤訊息）→ 繁中文案。
 *  insufficient stock 的完整訊息帶商品名（"insufficient stock for product X"），
 *  所以用 includes 子字串比對，不做全等。 */
const ORDER_ERROR_MESSAGES: [string, string][] = [
  ['cart is empty', '購物車是空的，請先加入商品'],
  ['invalid coupon', '優惠碼無效，請確認後再試'],
  ['course is full', '課程已額滿，請改選候補或其他班別'],
  ['already enrolled', '你已經報名過這堂課程了'],
  ['insufficient points', '點數不足，請取消使用點數折抵'],
  ['insufficient stock', '商品庫存不足，請減少數量或移除該項目'],
  ['duplicate checkout', '訂單處理中，請稍候再試']
];

/** 純函式：把 placeOrder 拋出的錯誤翻成使用者可讀的繁中訊息；
 *  未命中的錯誤（網路失敗、未知 5xx 等）落回通用文案。 */
export function orderErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const hit = ORDER_ERROR_MESSAGES.find(([needle]) => err.message.includes(needle));
    if (hit) return hit[1];
  }
  return '結帳失敗，請稍後再試';
}
