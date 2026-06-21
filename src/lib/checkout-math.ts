/* Dream Fly — 結帳金額計算，跨 surface 共用的純函式。
 *
 * CartSheet / CheckoutDialog 的 subtotal / couponOff / ptRedeem / total / earned 計算邏輯，
 * 抽成可單測的純函式。優惠碼查表→折抵、點數折抵夾擠、最終金額、回饋點數。
 * Mock-only。 */

/* Coupon codes（結帳優惠碼）— code → NT$ off。內聯自原 data.ts（mobile/member 兩份值相同）。 */
const COUPONS: Record<string, number> = { DREAMFLY100: 100, NEWYEAR500: 500, WELCOME50: 50 };

export interface CartMathLine {
  price: number;
  qty: number;
}

/** 套用優惠碼：查 COUPONS 表，回傳折抵金額（NT$）；查無回 null。code 比對前去空白並轉大寫。 */
export function lookupCoupon(code: string): { code: string; off: number } | null {
  const key = code.trim().toUpperCase();
  if (!key) return null;
  return COUPONS[key] != null ? { code: key, off: COUPONS[key] } : null;
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
