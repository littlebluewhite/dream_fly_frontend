/* Dream Fly — member 結帳前端邏輯單測：chargeableLines（純過濾）、validateCoupon
 * （真 API 優惠碼驗證）、orderErrorMessage（後端錯誤 → 繁中文案）。
 *
 * 舊本地結算 commitCheckout/CheckoutContext/CheckoutResult 及其測試已隨 final
 * review 移除 —— 金額/點數/報名/訂閱規則以後端為準（見 stores.ts placeOrder 與
 * checkout-api.test.ts 的呼叫序列測試），前端不再平行釘一份會漂移的數學。
 *
 * cart v3：CartItem.id 是 uuid string（這裡的 id 只是字串字面量，不代表真的
 * uuid 格式）。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chargeableLines, validateCoupon, orderErrorMessage } from './checkout';
import type { CartItem } from './checkout';
import { api, ApiError } from '$lib/api/client';

// 只替換 api()，ApiError 用回真實類別（validateCoupon 靠 instanceof 判斷 404）。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/* ─── 輔助 builders ─────────────────────────────────────────────── */
function makeCourse(id: string, price: number, qty = 1): CartItem {
  return { id, type: 'course', name: `課程 ${id}`, price, qty, icon: 'sparkles' };
}
function makePass(id: string, price: number, qty = 1): CartItem {
  return { id, type: 'pass', name: `方案 ${id}`, price, qty, icon: 'ticket' };
}

/* ─── chargeableLines ─────────────────────────────────────────── */
describe('chargeableLines', () => {
  it('過濾掉已持有的 pass，保留課程與未持有 pass', () => {
    const cart: CartItem[] = [makeCourse('1', 4800), makePass('1001', 3000), makePass('1002', 2000)];
    const result = chargeableLines(cart, [{ id: '1001' }]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['1', '1002']);
  });

  it('已持有的「課程」不會被過濾 — 過濾只針對 pass（課程重複由後端 409 already enrolled 把關）', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = chargeableLines(cart, [{ id: '1' }]); // 同 id 但 type 是 course
    expect(result).toHaveLength(1);
  });
});

/* ─── validateCoupon（真實 API 版，取代 checkout-math 的 lookupCoupon 查表）─── */
describe('validateCoupon', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('有效碼 → 呼叫 GET /coupons/{code}/validate（trim 過），discount_cents 換算 NT$', async () => {
    vi.mocked(api).mockResolvedValue({ code: 'DREAMFLY100', discount_cents: 10000 });

    const result = await validateCoupon('  dreamfly100  ');

    expect(api).toHaveBeenCalledWith('/coupons/dreamfly100/validate');
    expect(result).toEqual({ code: 'DREAMFLY100', off: 100 });
  });

  it('404（不存在／未啟用／已過期）→ null', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(404, 'coupon not found'));

    const result = await validateCoupon('NOPE');

    expect(result).toBeNull();
  });

  it('非 404 錯誤（如網路失敗、5xx）原樣拋出，不吞成 null', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(500, 'internal error'));

    await expect(validateCoupon('X')).rejects.toBeInstanceOf(ApiError);
  });
});

/* ─── orderErrorMessage（後端結帳錯誤 → 繁中 toast 文案）────────── */
describe('orderErrorMessage', () => {
  // 後端錯誤字串逐字對照 orders/enrolments/points service 原始碼
  // 與 integration-contract.md §3.10 的錯誤清單。
  it.each([
    ['cart is empty', '購物車是空的，請先加入商品'],
    ['invalid coupon', '優惠碼無效，請確認後再試'],
    ['course is full', '課程已額滿，請改選候補或其他班別'],
    ['already enrolled', '你已經報名過這堂課程了'],
    ['insufficient points', '點數不足，請取消使用點數折抵'],
    ['insufficient stock for product 單堂體驗課', '商品庫存不足，請減少數量或移除該項目'],
    ['duplicate checkout', '訂單處理中，請稍候再試']
  ])('後端 "%s" → 對應繁中文案', (backendMessage, expected) => {
    expect(orderErrorMessage(new ApiError(400, backendMessage))).toBe(expected);
  });

  it('未知的 ApiError 訊息 → 通用 fallback', () => {
    expect(orderErrorMessage(new ApiError(500, 'internal error'))).toBe('結帳失敗，請稍後再試');
  });

  it('非 ApiError（如 fetch 網路層 TypeError）→ 通用 fallback', () => {
    expect(orderErrorMessage(new Error('fetch failed'))).toBe('結帳失敗，請稍後再試');
  });
});
