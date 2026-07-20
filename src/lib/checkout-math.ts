/* Dream Fly — 結帳金額計算，跨 surface 共用的純函式。
 *
 * CartSheet / CheckoutDialog 的 subtotal / couponOff / ptRedeem / total / earned 計算邏輯，
 * 抽成可單測的純函式。點數折抵夾擠、最終金額、回饋點數——都是本地預覽用的算法，
 * 實際送單金額一律由後端 API 回應為準。優惠碼折抵改由 member/checkout.ts 的
 * validateCoupon()（真實 GET /coupons/{code}/validate）查詢，這裡不再保留本地
 * 查表版的 lookupCoupon()（CartSheet 是它最後一個呼叫端，已隨 Task 19 收尾改真
 * API，見該檔案）。 */

// type-only import:brand 型別編譯後零 runtime 邊（verbatimModuleSyntax 下必須
// `import type`），checkout-math 對 lib-root cart-item 只取型別、不開值依賴。
import type { ChargeableLine } from '$lib/cart-item';

export interface CartMathLine {
  price: number;
  qty: number;
}

/** 購物車小計：Σ price × qty。 */
export function subtotalOf(items: CartMathLine[]): number {
  return items.reduce((s, c) => s + c.price * c.qty, 0);
}

/** 結帳金額拆解。優惠碼折抵不超過小計；點數折抵不超過「優惠碼後金額」與可用點數；
 *  最終金額不為負；回饋點數＝最終金額的 5%（四捨五入）。
 *
 *  items 收窄為 `ChargeableLine[]`（見 $lib/cart-item）:「預覽金額只能算在可計費
 *  項目上」這條契約由輸入型別直接強制，不再是散文約定——`ChargeableLine` 的唯一
 *  產地是 chargeableLines()（member/checkout），呼叫端無從把未過濾的整車直接餵進
 *  來，預覽因此與請款（submitOrder）恆同源。內部小計仍走 subtotalOf（收較寬的
 *  CartMathLine[]，ChargeableLine 結構相容），計算本身只讀 price/qty、不變。 */
export function checkoutMath(
  items: ChargeableLine[],
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
