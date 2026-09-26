import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CartSheet from './CartSheet.svelte';
import { cart, toasts } from '$lib/mobile/stores';
import { points } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import type { Course } from '$lib/mobile/data';

/* CartSheet 結帳接真（複審後）：confirmPayment 現在打真實 POST /orders（復用
 * desktop member 的 syncCartToServer + api()，見 $lib/mobile/stores.ts 的
 * placeOrder()），取代原本的本地假 checkout()。只替換 $lib/api/client 的
 * api()，ApiError 用回真實類別（orderErrorMessage 靠 instanceof 判斷）。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

// K5-a：cart.add() 收窄為 add(course: Course)，檔頭原本的五欄鬆物件在 TS
// strict 下無法編譯（缺 level/cat/age/days/hot/coach/desc）——換成回傳完整
// Course 的 builder，其餘欄位沿用 CourseCard.test.ts 既有的 fixture 慣例。
function courseFixture(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course-uuid-9',
    name: '競技啦啦隊 進階班',
    level: '進階',
    cat: '競技啦啦隊',
    age: '6–12 歲',
    days: '週六 10:00',
    price: 4800,
    hot: false,
    coach: '',
    desc: '',
    spots: 3,
    icon: 'sparkles',
    ...overrides
  };
}
const COURSE = courseFixture();

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
    expect(JSON.parse(init.body as string)).toEqual({ use_points: false, payment_method: 'credit_card' });
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

/* C3(R13)：checkout 升為 $lib/mobile/stores.ts 的模組級單例，生命週期比 CartSheet
 * 這顆 mount 級元件活得久（見 stores.ts 與 checkout-controller.ts 檔頭）。checkout
 * 是跨測試共用的單例，不隨每個 it 重建——每個 it 結束前都要讓自己開出的 in-flight
 * promise 落地，否則殘留的 paying=true 會污染下一個 it（見各 it 結尾的 resolve）。 */
describe('CartSheet — C3(R13)：結帳生命週期比 sheet 活得久（checkout 是模組級單例）', () => {
  /** 手動控制 resolve 時序的 promise，用於停在「飛行中」驗證關閉守衛與 resumedInFlight。 */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  /** 開到付款中：加一門課、前往付款、確認付款，等 POST /orders 真的發出且停在飛行中。 */
  async function renderInFlightPayment(onClose: () => void = () => {}) {
    cart.add(COURSE);
    const d = deferred<unknown>();
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') return d.promise;
      if (path === '/points/me') return { balance: 0, ledger: [] };
      return undefined; // DELETE /cart、POST /cart/items
    });
    const utils = render(CartSheet, { props: { onClose } });
    await fireEvent.click(utils.getByText(/前往付款/));
    await fireEvent.click(utils.getByText(/確認付款/));
    await vi.waitFor(() => {
      const calls = vi.mocked(api).mock.calls.filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST');
      expect(calls).toHaveLength(1);
    });
    return { ...utils, resolveOrder: d.resolve };
  }

  /** 兩次 POST /orders 呼叫各自帶的 Idempotency-Key。 */
  function idempotencyKeysOf(calls: [string, RequestInit?][]) {
    return calls
      .filter(([p, i]) => p === '/orders' && (i as RequestInit)?.method === 'POST')
      .map(([, i]) => (i as RequestInit & { headers: Record<string, string> }).headers['Idempotency-Key']);
  }

  it('付款中 X／Esc／遮罩都關不掉', async () => {
    const onClose = vi.fn();
    const { getByLabelText, getByText, container, resolveOrder } = await renderInFlightPayment(onClose);

    await fireEvent.click(getByLabelText('關閉'));
    await fireEvent.keyDown(window, { key: 'Escape' });
    const scrim = container.querySelector('.df-scrim');
    expect(scrim).toBeTruthy();
    if (scrim) await fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();

    // 讓本測試開出的 in-flight promise 真的落地（paying 復位）——checkout 是跨測試
    // 共用的模組級單例，只確認呼叫次數不夠，不等到 confirmPay 的 finally 跑完，
    // 殘留的 paying=true 會污染下一個 it。
    resolveOrder(SAMPLE_ORDER);
    await vi.waitFor(() => expect(getByText('報名完成！')).toBeInTheDocument());
  });

  it('付款中卸載再重開：只有 1 次 POST /orders，重開後第二次確認被擋（resumedInFlight 鎖住 paying）', async () => {
    const { unmount, resolveOrder } = await renderInFlightPayment();
    unmount(); // 模擬 sheet 被導航觸發的 closeAll 關閉——不經 close() 守衛，直接卸載

    const reopened = render(CartSheet, { props: { onClose: () => {} } });
    await vi.waitFor(() => expect(reopened.getByText('處理中…')).toBeInTheDocument()); // resumedInFlight：paying 延續

    const ordersBefore = idempotencyKeysOf(vi.mocked(api).mock.calls as [string, RequestInit?][]);
    expect(ordersBefore).toHaveLength(1);

    await fireEvent.click(reopened.getByText('處理中…')); // 按鈕 disabled，點了也不會再送單
    const ordersAfter = idempotencyKeysOf(vi.mocked(api).mock.calls as [string, RequestInit?][]);
    expect(ordersAfter).toHaveLength(1);

    resolveOrder(SAMPLE_ORDER);
    await vi.waitFor(() => expect(reopened.getByText('報名完成！')).toBeInTheDocument());
  });

  it('409 之後重試沿用同一個 Idempotency-Key', async () => {
    cart.add(COURSE);
    let call = 0;
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') {
        call += 1;
        if (call === 1) throw new ApiError(409, 'course is full');
        return SAMPLE_ORDER;
      }
      if (path === '/points/me') return { balance: 0, ledger: [] };
      return undefined;
    });
    const { getByText } = render(CartSheet, { props: { onClose: () => {} } });

    await fireEvent.click(getByText(/前往付款/));
    await fireEvent.click(getByText(/確認付款/));
    // 失敗後按鈕從「處理中…」變回「確認付款」＝ paying 已復位，可以重試——不用
    // toasts 判斷本次已落地：toasts.notify 對相同 tone/title/body 會 dedup（bump
    // 既有 entry，見 $lib/stores/toasts.ts），長度增量在多次 409 場景下不可靠。
    await vi.waitFor(() => expect(getByText(/確認付款/)).toBeInTheDocument());

    await fireEvent.click(getByText(/確認付款/)); // 重試——沿用同一把 key，購物車未清空未擋按鈕
    await vi.waitFor(() => expect(getByText('報名完成！')).toBeInTheDocument());

    const keys = idempotencyKeysOf(vi.mocked(api).mock.calls as [string, RequestInit?][]);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('成功後重開是全新流程：新的一把 Idempotency-Key', async () => {
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (path === '/orders' && method === 'POST') return SAMPLE_ORDER;
      if (path === '/points/me') return { balance: 0, ledger: [] };
      return undefined;
    });

    cart.add(COURSE);
    const first = render(CartSheet, { props: { onClose: () => {} } });
    await fireEvent.click(first.getByText(/前往付款/));
    await fireEvent.click(first.getByText(/確認付款/));
    await vi.waitFor(() => expect(first.getByText('報名完成！')).toBeInTheDocument());
    first.unmount(); // setOpen(false)，讓下一次掛載偵測得到閉→開邊沿

    cart.add(COURSE); // 上一單成功已清空購物車，重開下一單要重新加
    const second = render(CartSheet, { props: { onClose: () => {} } });
    await fireEvent.click(second.getByText(/前往付款/));
    await fireEvent.click(second.getByText(/確認付款/));
    await vi.waitFor(() => expect(second.getByText('報名完成！')).toBeInTheDocument());

    const keys = idempotencyKeysOf(vi.mocked(api).mock.calls as [string, RequestInit?][]);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]); // freshCheckout 換發新 key
  });
});
