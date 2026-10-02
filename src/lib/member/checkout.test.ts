/* Dream Fly — member 結帳前端邏輯單測：chargeableLines（純過濾）、
 * applyCouponCode（「套用」按鈕的共用結果機，含真 API 優惠碼驗證的 404／錯誤分類）、
 * orderErrorMessage（後端錯誤 → 繁中文案）。
 *
 * 舊本地結算 commitCheckout/CheckoutContext/CheckoutResult 及其測試已隨 final
 * review 移除 —— 金額/點數/報名/訂閱規則以後端為準（見 checkout-sync.ts 的
 * createCheckout 與 checkout-sync.test.ts 的呼叫序列測試），前端不再平行釘一份
 * 會漂移的數學。
 *
 * cart v3：CartItem.id 是 uuid string（這裡的 id 只是字串字面量，不代表真的
 * uuid 格式）。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chargeableLines, applyCouponCode, orderErrorMessage } from './checkout';
import type { CartItem } from '$lib/cart-item';
import { api, ApiError } from '$lib/api/client';

// 只替換 api()，ApiError 用回真實類別（applyCouponCode 內層靠 instanceof 判斷 404）。
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

/* ─── applyCouponCode（「套用」按鈕的共用結果機：桌面 CheckoutDialog ↔ 行動版
 * CartSheet 雙生收斂，C2/R11）──────────────────────────────────── */
describe('applyCouponCode', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('空輸入（含只有空白）→ null：呼叫端不動任何狀態、不打 API（空輸入按「套用」不顯示錯誤）', async () => {
    expect(await applyCouponCode('')).toBeNull();
    expect(await applyCouponCode('   ')).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('命中 → 帶回優惠碼與空錯誤文案（呼叫端直接寫回 coupon/codeErr）', async () => {
    vi.mocked(api).mockResolvedValue({ code: 'DREAMFLY100', discount_cents: 10000 });

    expect(await applyCouponCode('DREAMFLY100')).toEqual({ coupon: { code: 'DREAMFLY100', off: 100 }, codeErr: '' });
  });

  it('呼叫 GET /coupons/{code}/validate（trim 過、不轉大寫），discount_cents 換算 NT$', async () => {
    vi.mocked(api).mockResolvedValue({ code: 'DREAMFLY100', discount_cents: 10000 });

    const result = await applyCouponCode('  dreamfly100  ');

    expect(api).toHaveBeenCalledWith('/coupons/dreamfly100/validate');
    expect(result).toEqual({ coupon: { code: 'DREAMFLY100', off: 100 }, codeErr: '' });
  });

  it('404（查無）與網路/未預期錯誤一視同仁 → 同一句「優惠碼無效或已過期」，不另開技術性文案', async () => {
    vi.mocked(api).mockRejectedValueOnce(new ApiError(404, 'coupon not found'));
    expect(await applyCouponCode('NOPE')).toEqual({ coupon: null, codeErr: '優惠碼無效或已過期' });

    vi.mocked(api).mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await applyCouponCode('NOPE')).toEqual({ coupon: null, codeErr: '優惠碼無效或已過期' });
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
