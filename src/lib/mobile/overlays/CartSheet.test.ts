import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CartSheet from './CartSheet.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { points } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';

/* CartSheet 結帳接真（複審後）：confirmPayment 現在打真實 POST /orders（復用
 * desktop member 的 syncCartToServer + api()，見 $lib/mobile/stores.ts 的
 * placeOrder()），取代原本的本地假 checkout()。只替換 $lib/api/client 的
 * api()，ApiError 用回真實類別（orderErrorMessage 靠 instanceof 判斷）。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const COURSE = { id: 'course-uuid-9', name: '競技啦啦隊 進階班', price: 4800, spots: 3, icon: 'sparkles' };

const SAMPLE_ORDER = {
  id: 'order-1',
  order_number: 'DF-0001',
  status: 'paid',
  total_cents: 480000,
  discount_cents: 0,
  coupon_code: null,
  points_used: 0,
  points_earned: 240,
  paid_at: '2026-07-07T00:00:00Z',
  created_at: '2026-07-07T00:00:00Z',
  items: [{ id: 'oi-1', item_type: 'course', product_id: null, course_id: COURSE.id, quantity: 1, unit_price_cents: 480000 }]
};

beforeEach(() => {
  cart.clear();
  points.set(0);
  vi.mocked(api).mockReset();
});

describe('CartSheet — 確認付款打真實下單 API（不是本地假成功）', () => {
  it('DELETE /cart → POST /cart/items(quantity 鎖 1) → POST /orders(帶 Idempotency-Key)；成功才清空購物車、跳完成步驟、水合真點數', async () => {
    cart.add(COURSE);
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') return SAMPLE_ORDER;
      if (path === '/points/me') return { balance: 240, ledger: [] };
      return undefined; // DELETE /cart、POST /cart/items
    });
    const { getByText } = render(CartSheet, { props: { onClose: () => {} } });

    await fireEvent.click(getByText(/前往付款/));
    await fireEvent.click(getByText(/確認付款/));

    await vi.waitFor(() => expect(getByText('報名完成！')).toBeInTheDocument());

    expect(api).toHaveBeenCalledWith('/cart', { method: 'DELETE' });
    expect(api).toHaveBeenCalledWith('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'course', item_id: COURSE.id, quantity: 1 })
    });
    const orderCall = vi.mocked(api).mock.calls.find(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
    expect(orderCall).toBeTruthy();
    const init = orderCall?.[1] as RequestInit & { headers: Record<string, string> };
    expect(JSON.parse(init.body as string)).toEqual({ use_points: false });
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    expect(get(cart)).toHaveLength(0); // 真成功才清空
    expect(get(points)).toBe(240); // 真點數餘額由 refreshPoints() 水合，不是本地估算
    expect(get(toasts).some((t) => t.tone === 'success' && t.body.includes('240'))).toBe(true);
  });
});

describe('CartSheet — 結帳失敗顯示後端真訊息（不是假成功）', () => {
  it('POST /orders 409（額滿）→ 顯示轉譯後的繁中訊息，購物車不清空，不跳完成步驟', async () => {
    cart.add(COURSE);
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') throw new ApiError(409, 'course is full');
      return undefined; // DELETE /cart、POST /cart/items、GET /points/me(onMount)
    });
    const { getByText, queryByText } = render(CartSheet, { props: { onClose: () => {} } });

    await fireEvent.click(getByText(/前往付款/));
    await fireEvent.click(getByText(/確認付款/));

    await vi.waitFor(() => {
      const tones = get(toasts);
      expect(tones.some((t) => t.tone === 'error' && t.body.includes('額滿'))).toBe(true);
    });
    expect(get(cart)).toHaveLength(1); // 未清空
    expect(queryByText('報名完成！')).toBeNull(); // 沒有跳到完成步驟
  });
});

describe('CartSheet — 優惠碼改走真實 GET /coupons/{code}/validate', () => {
  it('成功 → 套用優惠碼並顯示折抵金額', async () => {
    cart.add(COURSE);
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/points/me') return { balance: 0, ledger: [] };
      if (path.startsWith('/coupons/')) return { code: 'DREAMFLY100', discount_cents: 10000 };
      return undefined;
    });
    const { getByText, getByPlaceholderText } = render(CartSheet, { props: { onClose: () => {} } });

    await fireEvent.input(getByPlaceholderText('如 DREAMFLY100'), { target: { value: 'DREAMFLY100' } });
    await fireEvent.click(getByText('套用'));

    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/coupons/DREAMFLY100/validate');
      expect(getByText(/已套用 DREAMFLY100/)).toBeInTheDocument();
    });
  });

  it('404（查無優惠碼）→ 顯示「優惠碼無效或已過期」', async () => {
    cart.add(COURSE);
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/points/me') return { balance: 0, ledger: [] };
      if (path.startsWith('/coupons/')) throw new ApiError(404, 'coupon not found');
      return undefined;
    });
    const { getByText, getByPlaceholderText } = render(CartSheet, { props: { onClose: () => {} } });

    await fireEvent.input(getByPlaceholderText('如 DREAMFLY100'), { target: { value: 'NOPE' } });
    await fireEvent.click(getByText('套用'));

    await vi.waitFor(() => expect(getByText(/優惠碼無效或已過期/)).toBeInTheDocument());
  });
});

describe('CartSheet — 點數改讀真 $lib/member/stores（不是本地 mock 殘值）', () => {
  it('開啟時打 GET /points/me 水合真餘額並顯示（不是行動版本地 mock 的 ME.points）', async () => {
    cart.add(COURSE);
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/points/me') return { balance: 777, ledger: [] };
      return undefined;
    });
    const { getByText } = render(CartSheet, { props: { onClose: () => {} } });

    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/points/me');
      expect(getByText(/可用 777 點/)).toBeInTheDocument();
    });
  });
});

describe('CartSheet — 課程數量鎖 1（報名不是數量，同桌面 member cart 規則）', () => {
  it('購物車行沒有增減數量的按鈕', () => {
    cart.add(COURSE);
    const { queryByLabelText } = render(CartSheet, { props: { onClose: () => {} } });
    expect(queryByLabelText('加')).toBeNull();
    expect(queryByLabelText('減')).toBeNull();
  });
});
