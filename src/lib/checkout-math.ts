/* Dream Fly — 結帳金額計算，跨 surface 共用的純函式。
 *
 * CartSheet / CheckoutDialog 的 subtotal / couponOff / ptRedeem / total / earned 計算邏輯，
 * 抽成可單測的純函式。點數折抵夾擠、最終金額、回饋點數——都是本地預覽用的算法，
 * 實際送單金額一律由後端 API 回應為準。優惠碼折抵改由 member/checkout.ts 的
 * validateCoupon()（真實 GET /coupons/{code}/validate）查詢，這裡不再保留本地
 * 查表版的 lookupCoupon()（CartSheet 是它最後一個呼叫端，已隨 Task 19 收尾改真
 * API，見該檔案）。 */

export interface CartMathLine {
  price: number;
  qty: number;
}

/** 購物車小計：Σ price × qty。 */
export function subtotalOf(items: CartMathLine[]): number {
  return items.reduce((s, c) => s + c.price * c.qty, 0);
}

/** 結帳金額拆解。優惠碼折抵不超過小計；點數折抵不超過「優惠碼後金額」與可用點數；
 *  最終金額不為負；回饋點數＝最終金額的 5%（四捨五入）。 */
export function checkoutMath(
  items: CartMathLine[],
  coupon: { off: number } | null,
  points: number,
  usePoints: boolean
): { subtotal: number; couponOff: number; ptRedeem: number; total: number; earned: number } {
  const subtotal = subtotalOf(items);
  const couponOff = coupon ? Math.min(coupon.off, subtotal) : 0;
  const afterCoupon = subtotal - couponOff;
  const ptRedeem = usePoints ? Math.min(points, afterCoupon) : 0;
  const total = Math.max(0, afterCoupon - ptRedeem);
  const earned = Math.round(total * 0.05);
  return { subtotal, couponOff, ptRedeem, total, earned };
}
