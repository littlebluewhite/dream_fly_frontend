/* Dream Fly — 共享下單 orchestration 單測（B0.4）。
 *
 * 覆蓋 checkout-order.ts 的 submitOrder：全序列成功（sync → POST /orders 帶
 * Idempotency-Key → afterOrder 副作用 → clearCart → 回傳 OrderConfirmation）、
 * 失敗路徑（POST /orders 或 syncCartToServer 出錯都原樣拋出、不呼叫 afterOrder/
 * clearCart）、afterOrder 其中一支 reject 仍視為訂單成功、省略 idempotencyKey 時
 * 自產 uuid。mock 手法抄 member/checkout-api.test.ts：只替換 $lib/api/client 的
 * api()，ApiError 用回真實類別。syncCartToServer 是原樣搬入的既有邏輯，這裡只
 * 透過 submitOrder 的呼叫序列間接驗證它被正確串接，不重覆該檔案已有的逐項單測。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '$lib/api/client';
import { submitOrder } from './checkout-order';
import type { ApiOrder } from './checkout-order';
import type { CartItem } from '$lib/member/data';

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

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；未覆寫時 DELETE /cart 與
 *  POST /cart/items 預設回 undefined（204/成功 upsert），其餘一律丟錯──呼叫到
 *  沒被交代的端點應該讓測試失敗，而不是悄悄回傳 undefined 蓋掉斷言。抄自
 *  member/checkout-api.test.ts。 */
function fakeRouter(overrides: Record<string, unknown>) {
  return vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toString().toUpperCase();
    const key = `${method} ${path}`;
    if (key in overrides) {
      const value = overrides[key];
      if (value instanceof Error) throw value;
      return value;
    }
    if (path === '/cart' && method === 'DELETE') return undefined;
    if (path === '/cart/items' && method === 'POST') return undefined;
    throw new Error(`unexpected api call: ${key}`);
  });
}

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('submitOrder — 全序列成功', () => {
  it('sync → POST /orders 帶 Idempotency-Key → afterOrder 全 settle → clearCart → OrderConfirmation 各欄位正確', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }));
    const refreshA = vi.fn().mockResolvedValue(undefined);
    const refreshB = vi.fn().mockResolvedValue(undefined);
    const afterOrder = vi.fn(() => [refreshA(), refreshB()]);
    const clearCart = vi.fn();

    const confirmation = await submitOrder([COURSE_ITEM, PASS_ITEM], {
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
      body: JSON.stringify({ coupon_code: 'DREAMFLY100', use_points: false }),
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

  it('coupon 空字串 → coupon_code 整個欄位省略（不是送空字串）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }));

    await submitOrder([PASS_ITEM], { coupon: '', usePoints: true, idempotencyKey: 'key-xyz' });

    expect(api).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: JSON.stringify({ use_points: true }),
      headers: { 'Idempotency-Key': 'key-xyz' }
    });
  });
});

describe('submitOrder — 失敗路徑', () => {
  it('POST /orders 失敗 → 錯誤原樣拋出；afterOrder 與 clearCart 都不被呼叫', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': new ApiError(409, 'course is full') }));
    const afterOrder = vi.fn(() => [Promise.resolve(undefined)]);
    const clearCart = vi.fn();

    await expect(
      submitOrder([COURSE_ITEM], { coupon: '', usePoints: false, afterOrder, clearCart })
    ).rejects.toBeInstanceOf(ApiError);

    expect(afterOrder).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
  });

  it('syncCartToServer 失敗（DELETE /cart 出錯）→ 原樣拋出，不進下一步（不呼叫 POST /orders）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /cart': new ApiError(500, 'internal error') }));
    const clearCart = vi.fn();

    await expect(submitOrder([COURSE_ITEM], { coupon: '', usePoints: false, clearCart })).rejects.toBeInstanceOf(
      ApiError
    );

    expect(api).toHaveBeenCalledTimes(1); // 只有 DELETE /cart，沒有後續呼叫
    expect(clearCart).not.toHaveBeenCalled();
  });
});

describe('submitOrder — afterOrder 部分失敗', () => {
  it('afterOrder 其中一個 promise reject：仍回傳確認、clearCart 仍被呼叫、console.error 被呼叫', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }));
    const clearCart = vi.fn();
    const afterOrder = vi.fn(() => [Promise.resolve(undefined), Promise.reject(new Error('refresh failed'))]);

    const confirmation = await submitOrder([COURSE_ITEM], { coupon: '', usePoints: false, afterOrder, clearCart });

    expect(confirmation.orderNumber).toBe('DF-20260704ABCD1234');
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith('Failed to refresh after checkout:', expect.any(Error));

    errSpy.mockRestore();
  });
});

describe('submitOrder — idempotencyKey', () => {
  it('省略 idempotencyKey → 自產 uuid 格式的 key', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': SAMPLE_ORDER }));

    await submitOrder([COURSE_ITEM], { coupon: '', usePoints: false });

    const ordersCall = vi
      .mocked(api)
      .mock.calls.find(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    const init = ordersCall?.[1] as { headers: Record<string, string> };
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
