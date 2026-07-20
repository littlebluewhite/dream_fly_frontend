/* Dream Fly — member 結帳「真訂單」API 層單測（Task 16；Task 17 加了 refreshPoints
 * 的 ledger 映射與 refreshNotifications）
 *
 * 覆蓋 member 結帳網路層：$lib/checkout-order 的 syncCartToServer，以及 stores.ts barrel
 * 轉出的 placeOrder / refreshSubscriptions / refreshPoints / refreshNotifications。只替換
 * $lib/api/client 的 api()，ApiError
 * 用回真實類別（判斷 409/404 狀態碼要用 instanceof）。呼叫序列（DELETE→POST×N→
 * POST /orders→GET×2）是這裡的核心斷言，不是只驗證最終 state。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { syncCartToServer } from '$lib/checkout-order';
import type { ApiOrder } from '$lib/checkout-order';
import {
  cart,
  subscriptions,
  points,
  pointsLedger,
  notifications,
  notificationsHydrated,
  waitlist,
  waitlistHydrated,
  placeOrder,
  refreshSubscriptions,
  refreshPoints,
  refreshNotifications,
  hydrateWaitlist,
  joinWaitlist,
  cancelWaitlist,
  joinWaitlistErrorMessage
} from './stores';
import type { CartItem } from '$lib/cart-item';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

const COURSE_ITEM: CartItem = { id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, qty: 1, icon: 'sparkles' };
const PASS_ITEM: CartItem = { id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, qty: 1, icon: 'ticket' };

const SAMPLE_ORDER: ApiOrder = {
  id: 'order-1',
  order_number: 'DF-20260704ABCD1234',
  status: 'paid',
  total_cents: 470000,
  discount_cents: 10000,
  coupon_code: 'DREAMFLY100',
  points_used: 0,
  points_earned: 235,
  paid_at: '2026-06-22T00:00:00Z',
  created_at: '2026-06-22T00:00:00Z',
  items: [{ id: 'oi-1', item_type: 'course', product_id: null, course_id: 'course-uuid-9', quantity: 1, unit_price_cents: 480000 }]
};

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；未覆寫時 DELETE /cart 與
 *  POST /cart/items 預設回 undefined（204/成功 upsert），其餘一律丟錯──呼叫到
 *  沒被交代的端點應該讓測試失敗，而不是悄悄回傳 undefined 蓋掉斷言。
 *  覆寫值可以是函式（每次呼叫求值）——F2 race 釘的兩段式 GET 用它模擬真 server
 *  「首呼舊清單、次呼完整清單」。 */
function fakeRouter(overrides: Record<string, unknown>) {
  return vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toString().toUpperCase();
    const key = `${method} ${path}`;
    if (key in overrides) {
      const raw = overrides[key];
      const value = typeof raw === 'function' ? raw() : raw;
      if (value instanceof Error) throw value;
      return value;
    }
    if (path === '/cart' && method === 'DELETE') return undefined;
    if (path === '/cart/items' && method === 'POST') return undefined;
    throw new Error(`unexpected api call: ${key}`);
  });
}

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers
 *  （手法同 load-gate.test.ts 開頭的 createDeferred）。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** F2 和解重抓（mutator 尾隨的 void gate.refresh()）是 fire-and-forget——
 *  macrotask 跳一拍，讓其 fetch → apply 鏈完整收束後再斷言。 */
function settleReconcile() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

/** F1 用最小 AuthResponse——authStore.login() 走真實 applySession
 *  （setTokens + 登入態），登出邊沿才有得測。 */
const AUTH_RES = {
  access_token: 'at-f1',
  refresh_token: 'rt-f1',
  user: {
    id: 'u-f1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false,
    avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member']
  }
};

beforeEach(() => {
  localStorage.clear();
  cart.clear();
  waitlist.set([]);
  waitlistHydrated.set(false); // 模組單例旗標,不重置會跨 it 洩漏、讓 hydrateWaitlist 短路
  subscriptions.set([]);
  points.set(0);
  pointsLedger.set([]);
  notifications.set([]);
  notificationsHydrated.set(false);
  vi.mocked(api).mockReset();
});

describe('syncCartToServer — 呼叫序列與 quantity 規則', () => {
  it('DELETE /cart 後逐項 POST /cart/items；課程一律夾 quantity=1，方案照本地 qty', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({}));

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
    vi.mocked(api).mockImplementation(fakeRouter({}));

    await syncCartToServer([]);

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/cart', { method: 'DELETE' });
  });

  it('方案 qty > 1 時照實際 qty 送出（夾 1 只套用在課程）', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({}));

    await syncCartToServer([{ ...PASS_ITEM, qty: 2 }]);

    expect(api).toHaveBeenNthCalledWith(2, '/cart/items', {
      method: 'POST',
      body: JSON.stringify({ item_type: 'product', item_id: 'pass-uuid-9', quantity: 2 })
    });
  });
});

describe('placeOrder — 呼叫序列（sync → orders → hydrate → clear）', () => {
  it('完整序列：DELETE /cart → POST /cart/items ×N（課程 qty 夾 1）→ POST /orders 帶 Idempotency-Key → GET subscriptions/points → 本地購物車清空', async () => {
    cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });

    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /orders': SAMPLE_ORDER,
        'GET /subscriptions/me': [],
        'GET /points/me': { balance: 235 }
      })
    );

    const order = await placeOrder('DREAMFLY100', false, 'key-abc');

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
    expect(api).toHaveBeenNthCalledWith(5, '/subscriptions/me');
    expect(api).toHaveBeenNthCalledWith(6, '/points/me');
    expect(order.raw).toEqual(SAMPLE_ORDER);
    expect(order.total).toBe(4700); // ntd(470000) 換算後的 NT$ 整數
    expect(order.hasCourse).toBe(true);
    expect(order.hasPass).toBe(false);
    expect(order.orderNumber).toBe('DF-20260704ABCD1234');
    expect(get(cart)).toEqual([]);
    expect(get(points)).toBe(235);
  });

  it('已持有的 pass 不同步到 server — syncCartToServer 只送 chargeableLines（同意金額 ≡ 請款金額）', async () => {
    subscriptions.set([{ id: 'pass-uuid-9', name: '方案', since: '2026-06-01', price: 3000 }]);
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /orders': SAMPLE_ORDER,
        'GET /subscriptions/me': [],
        'GET /points/me': { balance: 0, ledger: [] }
      })
    );

    await placeOrder('', false, 'key-own');

    const itemPosts = vi
      .mocked(api)
      .mock.calls.filter(([p, i]) => p === '/cart/items' && (i as RequestInit)?.method === 'POST');
    expect(itemPosts).toHaveLength(1); // 只有課程；已持有的 pass 被排除，預覽跳過的絕不請款
    expect((itemPosts[0][1] as RequestInit).body).toBe(
      JSON.stringify({ item_type: 'course', item_id: 'course-uuid-9', quantity: 1 })
    );
  });

  it('coupon 空字串 → coupon_code 整個欄位省略（不是送空字串）', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /orders': SAMPLE_ORDER, 'GET /subscriptions/me': [], 'GET /points/me': { balance: 0 } })
    );

    await placeOrder('', true, 'key-xyz');

    expect(api).toHaveBeenCalledWith('/orders', {
      method: 'POST',
      body: JSON.stringify({ use_points: true, payment_method: 'credit_card' }),
      headers: { 'Idempotency-Key': 'key-xyz' }
    });
  });

  it('payment_method 預設 credit_card——呼叫端未指定第 4 個參數時', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /orders': SAMPLE_ORDER, 'GET /subscriptions/me': [], 'GET /points/me': { balance: 0 } })
    );

    await placeOrder('', false, 'key-default-pm');

    const ordersCall = vi.mocked(api).mock.calls.find(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    expect(JSON.parse((ordersCall?.[1] as RequestInit).body as string)).toMatchObject({ payment_method: 'credit_card' });
  });

  it('選了 line_pay → payment_method 送 line_pay', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /orders': SAMPLE_ORDER, 'GET /subscriptions/me': [], 'GET /points/me': { balance: 0 } })
    );

    await placeOrder('', false, 'key-line-pay', 'line_pay');

    const ordersCall = vi.mocked(api).mock.calls.find(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    expect(JSON.parse((ordersCall?.[1] as RequestInit).body as string)).toMatchObject({ payment_method: 'line_pay' });
  });

  it('未指定 idempotencyKey → 自動產生 uuid 格式的 key', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /orders': SAMPLE_ORDER, 'GET /subscriptions/me': [], 'GET /points/me': { balance: 0 } })
    );

    await placeOrder('', false);

    const ordersCall = vi.mocked(api).mock.calls.find(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    const init = ordersCall?.[1] as { headers: Record<string, string> };
    expect(init.headers['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('失敗後同一把 key 重試 → 兩次 POST /orders 帶相同 Idempotency-Key（不因重試換新 key）', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    let attempt = 0;
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') {
        attempt += 1;
        if (attempt === 1) throw new ApiError(409, 'course is full');
        return SAMPLE_ORDER;
      }
      if (path === '/subscriptions/me') return [];
      if (path === '/points/me') return { balance: 0 };
      return undefined; // DELETE /cart、POST /cart/items
    });

    await expect(placeOrder('', false, 'retry-key-1')).rejects.toBeInstanceOf(ApiError);
    // 失敗時本地購物車不會被清空，使用者可以直接重試、沿用同一把 key。
    await placeOrder('', false, 'retry-key-1');

    const orderCalls = vi
      .mocked(api)
      .mock.calls.filter(([path, init]) => path === '/orders' && (init as RequestInit)?.method === 'POST');
    expect(orderCalls).toHaveLength(2);
    expect((orderCalls[0][1] as { headers: Record<string, string> }).headers['Idempotency-Key']).toBe('retry-key-1');
    expect((orderCalls[1][1] as { headers: Record<string, string> }).headers['Idempotency-Key']).toBe('retry-key-1');
  });

  it('訂單已成立後，hydrate（subscriptions/points）其中一支網路失敗仍視為成功：cart 照樣清空、order 照樣回傳', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /orders': SAMPLE_ORDER,
        'GET /subscriptions/me': new ApiError(500, 'internal error'), // hydrate 失敗
        'GET /points/me': { balance: 235 }
      })
    );

    const order = await placeOrder('', false); // 不 reject — 訂單本身已成功

    expect(order.raw).toEqual(SAMPLE_ORDER);
    expect(get(cart)).toEqual([]); // 本地購物車仍照樣清空
    expect(get(points)).toBe(235); // 沒失敗的那支照樣 hydrate
  });
});

describe('placeOrder — 失敗路徑', () => {
  it('POST /orders 409（滿班）→ 錯誤原樣拋出；本地購物車不清空；不 hydrate subscriptions/points', async () => {
    cart.addItem({ id: 'course-uuid-9', type: 'course', name: '課程', price: 4800, icon: 'sparkles' });
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': new ApiError(409, 'course is full') }));

    let caught: unknown;
    try {
      await placeOrder('', false);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(409);
    expect(get(cart)).toHaveLength(1); // 未清空
    expect(api).not.toHaveBeenCalledWith('/subscriptions/me');
    expect(api).not.toHaveBeenCalledWith('/points/me');
  });

  it('POST /orders 400（優惠碼無效）→ 錯誤原樣拋出；本地購物車不清空', async () => {
    cart.addItem({ id: 'pass-uuid-9', type: 'pass', name: '方案', price: 3000, icon: 'ticket' });
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /orders': new ApiError(400, 'invalid coupon') }));

    await expect(placeOrder('BADCODE', false)).rejects.toMatchObject({ status: 400 });
    expect(get(cart)).toHaveLength(1);
  });
});

describe('refreshSubscriptions', () => {
  it('只留 status=active；id 換成 product_id；price_cents 換算 NT$；since 取 started_at 前 10 碼', async () => {
    vi.mocked(api).mockResolvedValue([
      {
        id: 'sub-1',
        product_id: 'prod-a',
        product_name: '方案A',
        status: 'active',
        started_at: '2026-06-01T00:00:00Z',
        expires_at: null,
        total_sessions: null,
        remaining_sessions: null,
        price_cents: 300000
      },
      {
        id: 'sub-2',
        product_id: 'prod-b',
        product_name: '方案B',
        status: 'expired',
        started_at: '2025-01-01T00:00:00Z',
        expires_at: '2025-12-31T00:00:00Z',
        total_sessions: 10,
        remaining_sessions: 0,
        price_cents: 200000
      }
    ]);

    await refreshSubscriptions();

    // expired 不算「已持有」— 不該擋掉重新購買，所以不進本地 subscriptions。
    expect(get(subscriptions)).toEqual([{ id: 'prod-a', name: '方案A', since: '2026-06-01', price: 3000 }]);
  });

  it('全部都不是 active → subscriptions 清空', async () => {
    vi.mocked(api).mockResolvedValue([
      {
        id: 'sub-1',
        product_id: 'prod-a',
        product_name: '方案A',
        status: 'cancelled',
        started_at: '2026-06-01T00:00:00Z',
        expires_at: null,
        total_sessions: null,
        remaining_sessions: null,
        price_cents: 300000
      }
    ]);

    await refreshSubscriptions();

    expect(get(subscriptions)).toEqual([]);
  });
});

describe('refreshPoints', () => {
  it('把 balance 寫入 points store', async () => {
    vi.mocked(api).mockResolvedValue({ balance: 888, ledger: [], total: 0, page: 1, per_page: 20 });

    await refreshPoints();

    expect(get(points)).toBe(888);
  });

  it('ledger 依 reason 映射 desc/type；date 取 created_at 前 10 碼並轉成 YYYY/MM/DD(Task 17)', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 500,
      ledger: [
        { id: 'l1', delta: 120, balance_after: 500, reason: 'checkout_earn', order_id: 'o1', created_at: '2026-07-01T09:00:00Z' },
        { id: 'l2', delta: -300, balance_after: 380, reason: 'checkout_redeem', order_id: 'o2', created_at: '2026-06-20T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    });

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l1', date: '2026/07/01', desc: '消費獲得點數', type: 'earn', delta: 120 },
      { id: 'l2', date: '2026/06/20', desc: '消費折抵點數', type: 'redeem', delta: -300 }
    ]);
  });

  it('admin_adjust 沒有專屬 UI bucket，依 delta 正負號借用 earn/expire', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 0,
      ledger: [
        { id: 'l3', delta: 50, balance_after: 50, reason: 'admin_adjust', order_id: null, created_at: '2026-05-01T00:00:00Z' },
        { id: 'l4', delta: -20, balance_after: 30, reason: 'admin_adjust', order_id: null, created_at: '2026-05-02T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    });

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l3', date: '2026/05/01', desc: '會員點數調整（增加）', type: 'earn', delta: 50 },
      { id: 'l4', date: '2026/05/02', desc: '會員點數調整（扣除）', type: 'expire', delta: -20 }
    ]);
  });

  it('redeem（點數兌換扣點，Task 14）有專屬 desc/type，與 checkout_redeem 分開', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 400,
      ledger: [{ id: 'l5', delta: -100, balance_after: 400, reason: 'redeem', order_id: null, created_at: '2026-07-06T00:00:00Z' }],
      total: 1, page: 1, per_page: 20
    });

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l5', date: '2026/07/06', desc: '兌換點數獎勵', type: 'redeem', delta: -100 }
    ]);
  });
});

describe('refreshNotifications(Task 17)', () => {
  it('把 GET /notifications 映射後寫入 notifications store，並把 notificationsHydrated 設為 true', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'n1', type: 'order_placed', title: '付款成功', message: '訂單已完成付款', is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' }
    ]);

    await refreshNotifications();

    expect(get(notifications)).toEqual([
      { id: 'n1', cat: 'order', icon: 'credit-card', tone: 'success', title: '付款成功', body: '訂單已完成付款', time: '2026-07-04 06:30', read: false }
    ]);
    expect(get(notificationsHydrated)).toBe(true);
    expect(api).toHaveBeenCalledWith('/notifications');
  });

  it('已經 hydrate 過就不重覆抓 —— 避免蓋掉本地已讀狀態(同通知頁 load() 的既有守衛)', async () => {
    notificationsHydrated.set(true);
    const sentinel = [{ id: 's1', cat: 'system' as const, icon: 'bell' as const, tone: 'neutral' as const, title: '哨兵', body: '', time: '2026-01-01 00:00', read: true }];
    notifications.set(sentinel);
    vi.mocked(api).mockResolvedValue([{ id: 'n2', type: 'system', title: '不該出現', message: '', is_read: false, metadata: null, created_at: '2026-07-04T00:00:00Z' }]);

    await refreshNotifications();

    expect(api).not.toHaveBeenCalled();
    expect(get(notifications)).toEqual(sentinel); // 未被覆寫
  });

  it('in-flight 中 notificationsHydrated 被其他來源設為 true（mutation）→ resolve 後不覆寫 store（post-await re-check，C1 最小修）', async () => {
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(async () => deferred.promise);

    const p = refreshNotifications(); // 通過 top guard（hydrated=false），fetch 掛起中

    const sentinel = [
      { id: 's2', cat: 'system' as const, icon: 'bell' as const, tone: 'neutral' as const, title: '飛行中寫入', body: '', time: '2026-01-01 00:00', read: true }
    ];
    notifications.set(sentinel); // 模擬 mutation：飛行中已有其他來源寫入
    notificationsHydrated.set(true);

    deferred.resolve([{ id: 'n3', type: 'system', title: '不該出現', message: '', is_read: false, metadata: null, created_at: '2026-07-04T00:00:00Z' }]);
    await p;

    expect(get(notifications)).toEqual(sentinel); // 過期回應未覆寫 mutation 勝出的結果
    expect(get(notificationsHydrated)).toBe(true);
  });
});

/* ---- Waitlist (候補) — Task 3（feat/backend-integration round 2）----
 * 覆蓋 stores.ts 新增的 hydrateWaitlist / joinWaitlist / cancelWaitlist 網路層，
 * 與 joinWaitlistErrorMessage 這個純函式（同 checkout.ts 的 orderErrorMessage
 * 慣例：只對後端已知的單一 409 原因給專屬文案，其餘落回通用 fallback）。
 * C1：水合改走 createHydrationGate（同上方 refreshNotifications 三 it 的協定），
 * 補 guard 短路 + race 釘。 */
describe('hydrateWaitlist', () => {
  it('GET /waitlist/me → 只留 status=waiting，映射成 WaitlistEntry（id/course_id/course_name），並把 waitlistHydrated 翻 true', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-01T00:00:00Z' },
      { id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(api).toHaveBeenCalledWith('/waitlist/me');
    // cancelled 的歷史紀錄不算「候補中」— 同 refreshSubscriptions 對 expired/cancelled 的處理慣例。
    expect(get(waitlist)).toEqual([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
    expect(get(waitlistHydrated)).toBe(true);
  });

  it('全部都是 cancelled → waitlist 清空', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(get(waitlist)).toEqual([]);
  });

  it('guard 短路:已經 hydrate 過就不重覆抓 —— 避免蓋掉本地 join/cancel 直寫的狀態（同 refreshNotifications 的守衛）', async () => {
    waitlistHydrated.set(true);
    const sentinel = [{ id: 'wl-s', course_id: 'course-uuid-7', course_name: '哨兵課程' }];
    waitlist.set(sentinel);
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-x', course_id: 'course-uuid-6', course_name: '不該出現', status: 'waiting', created_at: '2026-07-04T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(api).not.toHaveBeenCalled();
    expect(get(waitlist)).toEqual(sentinel); // 未被覆寫
  });

  it('race 釘（F2 後語意）:hydrate in-flight 期間 joinWaitlist() → 舊回應被丟棄（mutationWins）＋和解重抓收斂完整清單——新列存活、server 既有列不再永久失蹤', async () => {
    /* F2 語意差:C1 原釘只驗「丟棄舊回應」——最終 store 只剩 prepend 那一筆,而
     * markMutated 的 commit 讓 guarded() 從此短路,server 上既有列永不補回（F2 的
     * bug 本體）。現在 join 發現寫入當下未水合（旗標 false）→ 尾隨 gate.refresh()
     * 和解重抓:GET 改兩段式模擬真 server——首呼（hydrate）回舊清單、次呼（和解
     * 重抓;POST 已先完成）回含新列的完整清單。原釘的「prepend 新列存活」精神保留,
     * 由「丟棄舊回應」＋「和解重抓」共同保證。 */
    const API_WL_OLD = { id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' };
    const API_WL_NEW = { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' };
    const deferred = createDeferred<unknown[]>();
    let waitlistGets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /waitlist/me': () => {
        waitlistGets += 1;
        return waitlistGets === 1 ? deferred.promise : [API_WL_NEW, API_WL_OLD];
      },
      'POST /waitlist': API_WL_NEW
    }));

    const p = hydrateWaitlist(); // 通過 guarded()(旗標 false),GET /waitlist/me 首呼掛起中
    const entry = await joinWaitlist('course-uuid-9'); // 飛行中 mutation:直寫 prepend + markMutated(commit) + 和解重抓

    deferred.resolve([API_WL_OLD]); // 姍姍來遲的舊清單(不含新列)
    await p; // mutationWins:過期回應整包丟棄
    await settleReconcile();

    expect(waitlistGets).toBe(2); // 和解重抓真的發生
    expect(get(waitlist)).toEqual([
      { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程' }
    ]);
    expect(get(waitlist)[0]).toEqual(entry); // 原釘精神:prepend 的新列存活
    expect(get(waitlistHydrated)).toBe(true);
  });

  it('F1 跨登入洩漏釘:hydrate 完成後 authStore 登出 → 旗標翻 false + store 清空,下一個帳號 hydrate 重新真抓', async () => {
    /* SPA 登出（authStore.logout() + goto）沒有整頁重載,模組單例的 gate 旗標若不
     * 重置,B 帳號登入後 hydrateWaitlist() 被 guarded() 短路——直接看到 A 的候補。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /waitlist/me': [
        { id: 'wl-a', course_id: 'course-uuid-9', course_name: 'A 的候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
      ]
    }));

    await authStore.login('a@dreamfly.test', 'pw'); // 帳號 A 登入
    await hydrateWaitlist();
    expect(get(waitlist)).toHaveLength(1);
    expect(get(waitlistHydrated)).toBe(true);

    await authStore.logout(); // 「登入 → 登出」邊沿

    expect(get(waitlistHydrated)).toBe(false); // 旗標重置,guarded() 不再短路
    expect(get(waitlist)).toEqual([]); // A 的候補不留給 B

    const gets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/waitlist/me').length;
    const before = gets();
    await hydrateWaitlist(); // 帳號 B 再水合 → 真的重新 fetch
    expect(gets()).toBe(before + 1);
  });

  it('P1′ 在飛作廢釘:hydrate in-flight 期間登出 → 姍姍來遲的回應整包作廢(不套用、不 commit),B 帳號不繼承 A 的清單', async () => {
    /* F1 的邊沿重置只清「已落地」的狀態——登出前已出發的 GET 若在重置後才 resolve,
     * 沒有 epoch 核對就會把 A 的清單套回 store 並 commit true(重置後旗標 false,
     * mutationWins 不擋),B 帳號的 hydrate 被 guarded() 短路,直接看到 A 的候補。 */
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /waitlist/me': () => deferred.promise
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = hydrateWaitlist(); // A 的 GET 掛起中
    await authStore.logout(); // 在飛期間登出

    deferred.resolve([
      { id: 'wl-a', course_id: 'course-uuid-9', course_name: 'A 的候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
    ]);
    await expect(p).rejects.toThrow(); // 過期 fetch 作廢(gate 不套用、不 commit)

    expect(get(waitlist)).toEqual([]); // A 的清單沒有復活
    expect(get(waitlistHydrated)).toBe(false); // B 的 hydrate 不會被短路
  });
});

describe('joinWaitlist', () => {
  it('POST /waitlist 帶 course_id；成功後把回應塞進 store 最前面（新到舊，同 GET /waitlist/me 的排序）', async () => {
    waitlist.set([{ id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程' }]);
    vi.mocked(api).mockResolvedValue({
      id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z'
    });

    const entry = await joinWaitlist('course-uuid-9');

    expect(api).toHaveBeenCalledWith('/waitlist', {
      method: 'POST',
      body: JSON.stringify({ course_id: 'course-uuid-9' })
    });
    expect(entry).toEqual({ id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' });
    expect(get(waitlist)).toEqual([
      { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-old', course_id: 'course-uuid-1', course_name: '舊候補課程' }
    ]);
  });

  it('後端 409（重複候補）原樣拋出，不寫入 store', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(409, 'already on waitlist'));

    await expect(joinWaitlist('course-uuid-9')).rejects.toBeInstanceOf(ApiError);
    expect(get(waitlist)).toEqual([]);
  });

  it('F2 完整性釘:未 hydrate 直接 joinWaitlist → 和解重抓收斂為完整 server 清單(含既有列),旗標 true,之後 hydrate 被 guarded() 短路', async () => {
    /* 寫入當下旗標 false（從未 hydrate）→ 本地只有直寫那筆,server 既有列缺席;
     * 而 markMutated 的 commit 會讓 guarded() 從此短路——沒有和解重抓,既有列
     * 永不補回。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /waitlist': { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
      'GET /waitlist/me': [
        { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
        { id: 'wl-old', course_id: 'course-uuid-1', course_name: '既有候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
      ]
    }));

    await joinWaitlist('course-uuid-9');
    await settleReconcile();

    expect(get(waitlist)).toEqual([
      { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-old', course_id: 'course-uuid-1', course_name: '既有候補課程' }
    ]);
    expect(get(waitlistHydrated)).toBe(true);

    const calls = vi.mocked(api).mock.calls.length;
    await hydrateWaitlist(); // 和解重抓後水合真相已成立——guarded() 短路,不再重覆真抓
    expect(vi.mocked(api).mock.calls.length).toBe(calls);
  });

  it('P1′ 在飛作廢釘:POST in-flight 期間登出 → 回應到達後棄寫(不 prepend、不翻旗),A 的直寫不落在 B 的 store', async () => {
    const deferred = createDeferred<unknown>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'POST /waitlist': () => deferred.promise
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = joinWaitlist('course-uuid-9'); // A 的 POST 掛起中
    await authStore.logout();

    deferred.resolve({ id: 'wl-a', course_id: 'course-uuid-9', course_name: 'A 的候補課程', status: 'waiting', created_at: '2026-07-04T00:00:00Z' });
    const entry = await p; // server 端已成立,回傳值照舊(呼叫端元件已隨登出卸載,無害)

    expect(entry.id).toBe('wl-a');
    expect(get(waitlist)).toEqual([]); // 棄寫:A 的候補不落地
    expect(get(waitlistHydrated)).toBe(false); // 不翻旗:B 的 hydrate 照常真抓
  });

  it('P2′ 併發釘:兩支未水合 mutation 併發 → 各自排隊和解、序列化執行,晚快照(含兩筆)最後套用', async () => {
    /* 舊法在 POST await 之後才捕捉 wasHydrated——第一支 markMutated 翻旗後,第二支
     * 誤以為已水合、不排自己的和解;若唯一一次和解的快照又漏掉第二筆(GET 與第二支
     * POST 的 server 端 race),第二筆就從畫面消失。進場捕捉 + 串行鏈修掉這兩層。 */
    const post1 = createDeferred<unknown>();
    const post2 = createDeferred<unknown>();
    const API_WL_1 = { id: 'wl-1', course_id: 'course-uuid-1', course_name: '課程一', status: 'waiting', created_at: '2026-07-01T00:00:00Z' };
    const API_WL_2 = { id: 'wl-2', course_id: 'course-uuid-2', course_name: '課程二', status: 'waiting', created_at: '2026-07-02T00:00:00Z' };
    let posts = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /waitlist': () => (++posts === 1 ? post1.promise : post2.promise),
      'GET /waitlist/me': () => (++gets === 1 ? [API_WL_1] : [API_WL_2, API_WL_1]) // 首快照漏第二筆(server 端 race),次快照完整
    }));

    const p1 = joinWaitlist('course-uuid-1');
    const p2 = joinWaitlist('course-uuid-2'); // 兩支都在旗標 false 時進場
    post1.resolve(API_WL_1);
    post2.resolve(API_WL_2);
    await Promise.all([p1, p2]);
    await settleReconcile();

    expect(gets).toBe(2); // 兩支各自和解(舊法只有第一支會排)
    expect(get(waitlist)).toEqual([
      { id: 'wl-2', course_id: 'course-uuid-2', course_name: '課程二' },
      { id: 'wl-1', course_id: 'course-uuid-1', course_name: '課程一' }
    ]); // 序列化保證完整快照最後套用——第二筆存活,不被首快照倒序覆寫
  });

  it('P2′ 可重試釘:和解重抓失敗 → 旗標翻回 false 留下重試路徑,下一次 hydrate 重新真抓完整清單', async () => {
    /* 舊法失敗吞掉、旗標停在 true:store 只有直寫那筆卻被永久當成完整快照,之後所有
     * hydrate 都被短路——F2 原 bug 在一次暫時性 GET 失敗後原地復活。 */
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /waitlist': { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
      'GET /waitlist/me': () => (++gets === 1
        ? new Error('和解重抓網路失敗')
        : [
            { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
            { id: 'wl-old', course_id: 'course-uuid-1', course_name: '既有候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
          ])
    }));

    await joinWaitlist('course-uuid-9');
    await settleReconcile();

    expect(get(waitlistHydrated)).toBe(false); // 失敗不佯裝完整——可重試

    await hydrateWaitlist(); // 重試(例:下次進 mine 頁)
    expect(get(waitlist)).toEqual([
      { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-old', course_id: 'course-uuid-1', course_name: '既有候補課程' }
    ]);
    expect(get(waitlistHydrated)).toBe(true);
  });
});

describe('cancelWaitlist', () => {
  it('DELETE /waitlist/{id}；成功後從 store 移除該筆（204 No Content，同 syncCartToServer 的 DELETE /cart 慣例）', async () => {
    waitlist.set([
      { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' },
      { id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B' }
    ]);
    vi.mocked(api).mockResolvedValue(undefined);

    await cancelWaitlist('wl-1');

    expect(api).toHaveBeenCalledWith('/waitlist/wl-1', { method: 'DELETE' });
    expect(get(waitlist)).toEqual([{ id: 'wl-2', course_id: 'course-uuid-8', course_name: '課程B' }]);
  });

  it('失敗時原樣拋出，store 不變', async () => {
    waitlist.set([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
    vi.mocked(api).mockRejectedValue(new ApiError(404, 'waitlist entry not found'));

    await expect(cancelWaitlist('wl-1')).rejects.toBeInstanceOf(ApiError);
    expect(get(waitlist)).toEqual([{ id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A' }]);
  });
});

describe('joinWaitlistErrorMessage', () => {
  // 後端錯誤字串逐字對照 waitlist service 原始碼（dream_fly_backend/src/modules/waitlist/service.rs）。
  it('後端 409 "already on waitlist"（重複候補）→ 專屬繁中文案', () => {
    expect(joinWaitlistErrorMessage(new ApiError(409, 'already on waitlist'))).toBe('你已經在候補名單中了');
  });

  it('其餘錯誤（如課程未滿班的 409、網路失敗、非 ApiError）→ 通用 fallback', () => {
    expect(joinWaitlistErrorMessage(new ApiError(409, 'course is not full'))).toBe('加入候補失敗，請稍後再試');
    expect(joinWaitlistErrorMessage(new ApiError(500, 'internal error'))).toBe('加入候補失敗，請稍後再試');
    expect(joinWaitlistErrorMessage(new Error('network'))).toBe('加入候補失敗，請稍後再試');
  });
});
