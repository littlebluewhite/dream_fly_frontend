/* Dream Fly — 共享下單 orchestration 單測（B0.4）。
 *
 * 覆蓋 checkout-order.ts 的 submitOrder：全序列成功（sync → POST /orders 帶
 * Idempotency-Key → afterOrder 副作用 → clearCart → 回傳 OrderConfirmation）、
 * 失敗路徑（POST /orders 或 syncCartToServer 出錯都原樣拋出、不呼叫 afterOrder/
 * clearCart）、afterOrder 其中一支 reject 仍視為訂單成功、省略 idempotencyKey 時
 * 自產 uuid。mock 手法抄 member/checkout-api.test.ts：只替換 $lib/api/client 的
 * api()，ApiError 用回真實類別。syncCartToServer 是原樣搬入的既有邏輯，這裡只
 * 透過 submitOrder 的呼叫序列間接驗證它被正確串接，不重覆該檔案已有的逐項單測。 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from '$lib/api/client';
import { submitOrder } from './checkout-order';
import type { ApiOrder } from './checkout-order';
import type { CartItem } from '$lib/cart-item';
// submitOrder 的 lines 收窄為 ChargeableLine[]（可計費約束 brand）。fixtures 改用真
// producer chargeableLines(items, []) 打上 brand（空訂閱 → 不濾任何項，course/pass
// 原樣保留），比檔內 cast 更貼近 production:CartSheet/desktop 都是經這個唯一產地
// 把行送進 submitOrder。這是 lib-root 測試（不受 mobile seam 掃描約束），直取 member
// 的 pure producer 屬佈線證明手段。
// 覆蓋缺口明錄:「已持有 pass 被濾掉」的 runtime 濾除案例由 member/checkout.test.ts 覆蓋;
// mobile runtime 不可建構(cart.add 只收 Course),故本檔 fixtures 一律空訂閱、不假造濾除情境。
import { chargeableLines } from '$lib/member/checkout';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const COURSE_ITEM: CartItem = { id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, qty: 1, icon: 'sparkles' };
const PASS_ITEM: CartItem = { id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, qty: 1, icon: 'ticket' };

// items 同時含 course 與 product 兩種 item_type，讓 hasCourse/hasPass 兩個欄位
// 都有非預設值可斷言（而不是只驗證其中一個維持 false）。
const SAMPLE_ORDER: ApiOrder = {
  id: 'order-1',
  order_number: 'DF-20260704ABCD1234',
  status: 'paid',
  total_cents: 470000,
  discount_cents: 10000,
  coupon_code: 'DREAMFLY100',
  points_used: 100,
  points_earned: 235,
  paid_at: '2026-06-22T00:00:00Z',
  created_at: '2026-06-22T00:00:00Z',
  items: [
    { id: 'oi-1', item_type: 'course', product_id: null, course_id: 'course-uuid-9', quantity: 1, unit_price_cents: 480000 },
    { id: 'oi-2', item_type: 'product', product_id: 'pass-uuid-9', course_id: null, quantity: 1, unit_price_cents: 300000 }
  ]
};

/** cart 呼叫預設：未覆寫時 DELETE /cart 與 POST /cart/items 回 undefined（204/成功
 *  upsert）——沿用原本 fakeRouter 內建的 cart fallback，經由 defaults 表傳入共用
 *  fakeRouter。 */
const CART_DEFAULTS: Record<string, unknown> = { 'DELETE /cart': undefined, 'POST /cart/items': undefined };

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('submitOrder — 全序列成功', () => {
  it('sync → POST /orders 帶 Idempotency-Key → afterOrder 全 settle → clearCart → OrderConfirmation 各欄位正確', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));
    const refreshA = vi.fn().mockResolvedValue(undefined);
    const refreshB = vi.fn().mockResolvedValue(undefined);
    const afterOrder = vi.fn(() => [refreshA(), refreshB()]);
    const clearCart = vi.fn();

    const confirmation = await submitOrder(chargeableLines([COURSE_ITEM, PASS_ITEM], []), {
      coupon: 'DREAMFLY100',
      usePoints: false,
      idempotencyKey: 'key-abc',
      afterOrder,
      clearCart
    });

    expect(api).toHaveBeenNthCalledWith(1, '/cart', { method: 'DELETE' });
    expect(api).toHaveBeenNthCalledWith(2, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'course', item_id: 'course-uuid-9', quantity: 1 })
    });
    expect(api).toHaveBeenNthCalledWith(3, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'product', item_id: 'pass-uuid-9', quantity: 1 })
    });
    expect(api).toHaveBeenNthCalledWith(4, '/orders', {
      method: 'POST',
      body: JSON.stringify({ coupon_code: 'DREAMFLY100', use_points: false, payment_method: 'credit_card' }),
      headers: { 'Idempotency-Key': 'key-abc' }
    });
    expect(api).toHaveBeenCalledTimes(4);

    expect(afterOrder).toHaveBeenCalledTimes(1);
    expect(refreshA).toHaveBeenCalledTimes(1);
    expect(refreshB).toHaveBeenCalledTimes(1);
    expect(clearCart).toHaveBeenCalledTimes(1);

    expect(confirmation).toEqual({
      total: 4700, // ntd(470000)
      earned: 235,
      ptRedeem: 100,
      orderNumber: 'DF-20260704ABCD1234',
      hasCourse: true,
      hasPass: true,
      raw: SAMPLE_ORDER
    });
  });

  it('coupon 空字串 → coupon_code 整個欄位省略（不是送空字串）；payment_method 未指定時預設 credit_card', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));

    await submitOrder(chargeableLines([PASS_ITEM], []), { coupon: '', usePoints: true, idempotencyKey: 'key-xyz' });

    expect(api).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: JSON.stringify({ use_points: true, payment_method: 'credit_card' }),
      headers: { 'Idempotency-Key': 'key-xyz' }
    });
  });

  it('paymentMethod 指定 line_pay → POST /orders body 帶 payment_method: line_pay（Round 4 P4-B1 值域穿透縫層）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));

    await submitOrder(chargeableLines([PASS_ITEM], []), { coupon: '', usePoints: false, paymentMethod: 'line_pay', idempotencyKey: 'key-lp' });

    expect(api).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: JSON.stringify({ use_points: false, payment_method: 'line_pay' }),
      headers: { 'Idempotency-Key': 'key-lp' }
    });
  });
});

describe('submitOrder — 失敗路徑', () => {
  it('POST /orders 失敗 → 錯誤原樣拋出；afterOrder 與 clearCart 都不被呼叫', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': new ApiError(409, 'course is full') }, CART_DEFAULTS));
    const afterOrder = vi.fn(() => [Promise.resolve(undefined)]);
    const clearCart = vi.fn();

    await expect(
      submitOrder(chargeableLines([COURSE_ITEM], []), { coupon: '', usePoints: false, afterOrder, clearCart })
    ).rejects.toBeInstanceOf(ApiError);

    expect(afterOrder).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('syncCartToServer 失敗（DELETE /cart 出錯）→ 原樣拋出，不進下一步（不呼叫 POST /orders）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /cart': new ApiError(500, 'internal error') }, CART_DEFAULTS));
    const clearCart = vi.fn();

    await expect(submitOrder(chargeableLines([COURSE_ITEM], []), { coupon: '', usePoints: false, clearCart })).rejects.toBeInstanceOf(
      ApiError
    );

    expect(api).toHaveBeenCalledTimes(1); // 只有 DELETE /cart，沒有後續呼叫
    expect(clearCart).not.toHaveBeenCalled();
  });
});

describe('submitOrder — afterOrder 部分失敗', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('afterOrder 其中一個 promise reject：仍回傳確認、clearCart 仍被呼叫、console.error 被呼叫', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));
    const clearCart = vi.fn();
    const afterOrder = vi.fn(() => [Promise.resolve(undefined), Promise.reject(new Error('refresh failed'))]);

    const confirmation = await submitOrder(chargeableLines([COURSE_ITEM], []), { coupon: '', usePoints: false, afterOrder, clearCart });

    expect(confirmation.orderNumber).toBe('DF-20260704ABCD1234');
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith('Failed to refresh after checkout:', expect.any(Error));
  });
});

describe('submitOrder — idempotencyKey', () => {
  it('省略 idempotencyKey → 自產 uuid 格式的 key', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }, CART_DEFAULTS));

    await submitOrder(chargeableLines([COURSE_ITEM], []), { coupon: '', usePoints: false });

    const ordersCall = vi
      .mocked(api)
      .mock.calls.find(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    const init = ordersCall?.[1] as { headers: Record<string, string> };
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

// 可計費約束的編譯期反例（成對；同 checkout-math.test.ts 與 load-gate.test.ts 先例）——
// 未經 chargeableLines 過濾的裸 CartItem[] 不得直接進 submitOrder:lines 必須是已濾過
// 的 ChargeableLine[]（「預覽合計 ≡ 實際請款」）。雙向性由 tsc 保證:若步驟 4 悄悄把
// submitOrder 放寬回收 CartItem[]，下面那行的型別錯誤會消失、@ts-expect-error 變成
// unused directive → `npm run check` 轉紅。這條只驗型別、不執行（it.skip）。
it.skip('型別:未經 chargeableLines 的裸 CartItem[] 不得直接進 submitOrder（可計費約束）', () => {
  // @ts-expect-error 裸 CartItem[] 缺 ChargeableLine brand，唯一產地是 chargeableLines()
  void submitOrder([COURSE_ITEM], { coupon: '', usePoints: false });
});
