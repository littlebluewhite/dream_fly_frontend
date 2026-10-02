/* Dream Fly — checkout-order.ts 的 syncCartToServer 單測。
 *
 * 送單序列（sync → POST /orders → refresh → clear）已收進 member/checkout-sync.ts 的
 * createCheckout，其覆蓋在 checkout-sync.test.ts；本檔只釘 syncCartToServer 自身的
 * 呼叫序列與 quantity 規則。只替換 $lib/api/client 的 api()。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '$lib/api/client';
import { syncCartToServer } from './checkout-order';
import type { CartItem } from '$lib/cart-item';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const COURSE_ITEM: CartItem = { id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, qty: 1, icon: 'sparkles' };
const PASS_ITEM: CartItem = { id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, qty: 1, icon: 'ticket' };

/** DELETE /cart 與 POST /cart/items 回 undefined（204/成功 upsert）。 */
const CART_DEFAULTS: Record<string, unknown> = { 'DELETE /cart': undefined, 'POST /cart/items': undefined };

beforeEach(() => {
  vi.mocked(api).mockReset();
});

describe('syncCartToServer — 呼叫序列與 quantity 規則', () => {
  it('DELETE /cart 後逐項 POST /cart/items；課程一律夾 quantity=1，方案照本地 qty', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({}, CART_DEFAULTS));

    await syncCartToServer([{ ...COURSE_ITEM, qty: 3 }, PASS_ITEM]);

    expect(api).toHaveBeenNthCalledWith(1, '/cart', { method: 'DELETE' });
    expect(api).toHaveBeenNthCalledWith(2, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'course', item_id: 'course-uuid-9', quantity: 1 })
    });
    expect(api).toHaveBeenNthCalledWith(3, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'product', item_id: 'pass-uuid-9', quantity: 1 })
    });
    expect(api).toHaveBeenCalledTimes(3);
  });

  it('空購物車 → 只呼叫 DELETE /cart，沒有任何 POST', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({}, CART_DEFAULTS));

    await syncCartToServer([]);

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/cart', { method: 'DELETE' });
  });

  it('方案 qty > 1 時照實際 qty 送出（夾 1 只套用在課程）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({}, CART_DEFAULTS));

    await syncCartToServer([{ ...PASS_ITEM, qty: 2 }]);

    expect(api).toHaveBeenNthCalledWith(2, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'product', item_id: 'pass-uuid-9', quantity: 2 })
    });
  });
});
