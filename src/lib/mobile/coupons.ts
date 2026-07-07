/* Dream Fly — mobile 展示殼專用的優惠碼查表（Task 11 P2 清理，從 checkout-math.ts 搬出）。
 *
 * P2：這是純前端硬編查表，僅供 mobile CartSheet 這個展示殼使用；member 結帳走真實
 * API GET /coupons/{code}/validate（見 member/checkout.ts 的 validateCoupon）。mobile
 * 已接上真實登入與全部 screens（docs/adr/0006，2026-07-07 更新），但 CartSheet 的購物車/
 * 結帳流程本身仍未接真後端訂單 API（見 mobile/stores.ts 的 checkout()），故保留這份
 * mock 查表。 */

/* Coupon codes（結帳優惠碼）— code → NT$ off。內聯自原 data.ts（mobile/member 兩份值相同）。 */
const COUPONS: Record<string, number> = { DREAMFLY100: 100, NEWYEAR500: 500, WELCOME50: 50 };

/** 套用優惠碼：查 COUPONS 表，回傳折抵金額（NT$）；查無回 null。code 比對前去空白並轉大寫。 */
export function lookupCoupon(code: string): { code: string; off: number } | null {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  return COUPONS[key] != null ? { code: key, off: COUPONS[key] } : null;
}
