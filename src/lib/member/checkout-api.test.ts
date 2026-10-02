/* Dream Fly — member 結帳「真訂單」API 層單測（Task 16；Task 17 加了 refreshPoints
 * 的 ledger 映射與 hydrateNotifications；Task 9(架構深化 R15·F-5) 把「送單」呼叫序列
 * 的覆蓋搬到 checkout-sync.test.ts；FE-5 起 syncCartToServer 的單測住 checkout-order.test.ts）
 *
 * 覆蓋 stores.ts barrel 轉出的 refreshSubscriptions / refreshPoints / hydrateNotifications
 * 與候補。只替換 $lib/api/client 的 api()，ApiError
 * 用回真實類別（判斷 409/404 狀態碼要用 instanceof）。呼叫序列（DELETE→POST×N→
 * POST /orders→GET×2）是 checkout-sync.test.ts 的核心斷言，不是只驗證最終 state。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import {
  cart,
  subscriptions,
  points,
  pointsLedger,
  notifications,
  notificationsHydrated,
  waitlist,
  waitlistHydrated,
  refreshSubscriptions,
  refreshPoints,
  hydrateNotifications,
  hydrateWaitlist,
  joinWaitlist,
  cancelWaitlist,
  joinWaitlistErrorMessage,
  markRead
} from './stores';
import { resetWaitlistForTests } from './waitlist';
import { resetNotificationsForTests } from './notifications';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/** cart 呼叫預設：未覆寫時 DELETE /cart 與 POST /cart/items 回 undefined（204/成功
 *  upsert）——沿用原本 fakeRouter 內建的 cart fallback，經由 defaults 表傳入共用
 *  fakeRouter。 */
const CART_DEFAULTS: Record<string, unknown> = { 'DELETE /cart': undefined, 'POST /cart/items': undefined };

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
  resetWaitlistForTests(); // 模組單例閘門,不重置會跨 it 洩漏、讓 hydrateWaitlist 短路
  subscriptions.set([]);
  points.set(0);
  pointsLedger.set([]);
  notifications.set([]);
  resetNotificationsForTests();
  vi.mocked(api).mockReset();
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

  it('F1 跨登入洩漏釘:refreshSubscriptions 後登出 → subscriptions 重置為空(boot 態),換帳不殘留 A 的訂閱', async () => {
    /* C1 抬升:subscriptions 原本全無守衛,換帳後 A 的訂閱殘留。createSessionRefresher
     * 的 reset 在 identity 變更時把 subscriptions 歸 boot 態(空)。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /subscriptions/me': [
        { id: 'sub-a', product_id: 'prod-a', product_name: '方案A', status: 'active', started_at: '2026-06-01T00:00:00Z', expires_at: null, total_sessions: null, remaining_sessions: null, price_cents: 300000 }
      ]
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    await refreshSubscriptions();
    expect(get(subscriptions)).toHaveLength(1);

    await authStore.logout();

    expect(get(subscriptions)).toEqual([]); // A 的訂閱不留給 B(boot 態空)
  });

  it('P1′ 在飛作廢釘:refreshSubscriptions in-flight 期間登出 → 回應靜默丟棄(不套用、不 throw)', async () => {
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /subscriptions/me': () => deferred.promise
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = refreshSubscriptions(); // A 的 GET 掛起中
    await authStore.logout();

    deferred.resolve([
      { id: 'sub-a', product_id: 'prod-a', product_name: '方案A', status: 'active', started_at: '2026-06-01T00:00:00Z', expires_at: null, total_sessions: null, remaining_sessions: null, price_cents: 300000 }
    ]);
    await expect(p).resolves.toBeUndefined(); // 靜默:resolve、不 throw

    expect(get(subscriptions)).toEqual([]); // A 的訂閱沒套用
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

  it('admin_adjust 有專屬 adjust bucket，正負號都用同一個「會員點數調整」', async () => {
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
      { id: 'l3', date: '2026/05/01', desc: '會員點數調整', type: 'adjust', delta: 50 },
      { id: 'l4', date: '2026/05/02', desc: '會員點數調整', type: 'adjust', delta: -20 }
    ]);
  });

  it('refund_restore / refund_clawback 各有專屬退款文案，type 皆為 refund', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 0,
      ledger: [
        { id: 'r1', delta: 300, balance_after: 300, reason: 'refund_restore', order_id: 'o1', created_at: '2026-07-02T00:00:00Z' },
        { id: 'r2', delta: -120, balance_after: 180, reason: 'refund_clawback', order_id: 'o1', created_at: '2026-07-03T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    });

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'r1', date: '2026/07/02', desc: '訂單退款・退回折抵點數', type: 'refund', delta: 300 },
      { id: 'r2', date: '2026/07/03', desc: '訂單退款・收回回饋點數', type: 'refund', delta: -120 }
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

  it('F1 跨登入洩漏釘:refreshPoints 後登出 → points/ledger 重置為 boot 態(0 / `[]`),換帳不殘留 A 的餘額', async () => {
    /* C1 抬升:points 原本全無守衛,換帳後 A 的餘額殘留(殘影窗口)。createSessionRefresher
     * 的 reset 在 identity 變更時把 points/ledger 歸 boot 態。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /points/me': { balance: 777, ledger: [{ id: 'la', delta: 777, balance_after: 777, reason: 'checkout_earn', order_id: null, created_at: '2026-07-01T00:00:00Z' }] }
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    await refreshPoints();
    expect(get(points)).toBe(777);
    expect(get(pointsLedger)).toHaveLength(1);

    await authStore.logout();

    expect(get(points)).toBe(0); // 重置為 boot 態
    expect(get(pointsLedger)).toEqual([]); // 重置為 boot 態(R14 F3:誠實開機,開機值 = reset 值 = `[]`)
  });

  it('P1′ 在飛作廢釘:refreshPoints in-flight 期間登出 → 回應靜默丟棄(不套用、不 throw),不新增換帳失敗模式', async () => {
    /* refresher 的在飛作廢必須靜默 return(不 throw)——redeemReward await refreshPoints、
     * placeOrder afterOrder 會傳播 rejection,若換帳改 throw 等於新增失敗模式。 */
    const deferred = createDeferred<{ balance: number; ledger: unknown[] }>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /points/me': () => deferred.promise
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = refreshPoints(); // A 的 GET 掛起中
    await authStore.logout(); // 在飛換帳

    deferred.resolve({ balance: 777, ledger: [] });
    await expect(p).resolves.toBeUndefined(); // 靜默:resolve、不 throw

    expect(get(points)).toBe(0); // A 的餘額沒套用(維持 logout reset 的 boot 態)
  });
});

describe('hydrateNotifications(Task 17)', () => {
  it('把 GET /notifications 映射後寫入 notifications store，並把 notificationsHydrated 設為 true', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'n1', type: 'order_placed', title: '付款成功', message: '訂單已完成付款', is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' }
    ]);

    await hydrateNotifications();

    expect(get(notifications)).toEqual([
      { id: 'n1', cat: 'order', icon: 'credit-card', tone: 'success', title: '付款成功', body: '訂單已完成付款', time: '2026-07-04 06:30', read: false }
    ]);
    expect(get(notificationsHydrated)).toBe(true);
    expect(api).toHaveBeenCalledWith('/notifications');
  });

  it('已經 hydrate 過就不重覆抓 —— 避免蓋掉本地已讀狀態(同通知頁 load() 的既有守衛)', async () => {
    vi.mocked(api).mockResolvedValue([{ id: 's1', type: 'system', title: '哨兵', message: '', is_read: true, metadata: null, created_at: '2026-01-01T00:00:00Z' }]);
    await hydrateNotifications(); // 哨兵經真水合落地、旗標 true(旗標唯讀)
    const sentinel = get(notifications);
    vi.mocked(api).mockClear();
    vi.mocked(api).mockResolvedValue([{ id: 'n2', type: 'system', title: '不該出現', message: '', is_read: false, metadata: null, created_at: '2026-07-04T00:00:00Z' }]);

    await hydrateNotifications();

    expect(api).not.toHaveBeenCalled();
    expect(get(notifications)).toEqual(sentinel); // 未被覆寫
  });

  it('in-flight 中 notificationsHydrated 被其他來源設為 true（mutation）→ resolve 後不覆寫 store（post-await re-check，C1 最小修）', async () => {
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(async () => deferred.promise);

    const p = hydrateNotifications(); // 通過 top guard（hydrated=false），fetch 掛起中

    const sentinel = [
      { id: 's2', cat: 'system' as const, icon: 'bell' as const, tone: 'neutral' as const, title: '飛行中寫入', body: '', time: '2026-01-01 00:00', read: true }
    ];
    notifications.set(sentinel); // 模擬 mutation：飛行中已有其他來源寫入
    void markRead('s2'); // 真 mutation 翻旗(旗標唯讀;s2 本已讀,store 內容不變)

    deferred.resolve([{ id: 'n3', type: 'system', title: '不該出現', message: '', is_read: false, metadata: null, created_at: '2026-07-04T00:00:00Z' }]);
    await p;

    expect(get(notifications)).toEqual(sentinel); // 過期回應未覆寫 mutation 勝出的結果
    expect(get(notificationsHydrated)).toBe(true);
  });

  it('F1 跨登入洩漏釘:hydrate 完成後 authStore 登出 → 旗標翻 false + 通知重置為 `[]`,下一個帳號 refresh 重新真抓', async () => {
    /* C1 抬升:notificationsHydrated 原本跨帳號存活(真缺陷)——SPA 登出無整頁重載,
     * B 帳號的 getDashboard → hydrateNotifications 被 guarded() 短路,直接讀到 A 的通知。
     * 改走 createSessionGate 後 identity 變更即 reset(旗標 false + 通知回 boot 態 `[]`)。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /notifications': [
        { id: 'na', type: 'system', title: 'A 的通知', message: '', is_read: false, metadata: null, created_at: '2026-07-01T00:00:00Z' }
      ]
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    await hydrateNotifications();
    expect(get(notifications).map((n) => n.id)).toEqual(['na']);
    expect(get(notificationsHydrated)).toBe(true);

    await authStore.logout(); // 「登入 → 登出」邊沿

    expect(get(notificationsHydrated)).toBe(false); // 旗標重置,guarded() 不再短路
    expect(get(notifications)).toEqual([]); // A 的通知不留給 B,重置為 boot 態 `[]`

    const gets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/notifications').length;
    const before = gets();
    await hydrateNotifications(); // 帳號 B 再水合 → 真的重新 fetch
    expect(gets()).toBe(before + 1);
  });

  it('P1′ 在飛作廢釘:refresh in-flight 期間登出 → 姍姍來遲的回應整包作廢(不套用、不 commit),B 不繼承 A 的通知', async () => {
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /notifications': () => deferred.promise
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = hydrateNotifications(); // A 的 GET 掛起中
    await authStore.logout(); // 在飛期間登出

    deferred.resolve([
      { id: 'na', type: 'system', title: 'A 的通知', message: '', is_read: false, metadata: null, created_at: '2026-07-01T00:00:00Z' }
    ]);
    await expect(p).rejects.toThrow(); // 過期 fetch 作廢(gate 不套用、不 commit)

    expect(get(notifications)).toEqual([]); // A 的通知沒有落地(維持 logout reset 的 `[]`)
    expect(get(notificationsHydrated)).toBe(false); // B 的 refresh 不會被短路
  });
});

/* ---- Waitlist (候補) — Task 3（feat/backend-integration round 2）----
 * 覆蓋 stores.ts 新增的 hydrateWaitlist / joinWaitlist / cancelWaitlist 網路層，
 * 與 joinWaitlistErrorMessage 這個純函式（同 checkout.ts 的 orderErrorMessage
 * 慣例：只對後端已知的單一 409 原因給專屬文案，其餘落回通用 fallback）。
 * C1（架構深化 R7）：水合改走 createSessionGate（同上方 hydrateNotifications 的
 * session 協定 its）；泛型深層協定已移入 session-gate.test，本檔僅留薄 adapter 釘
 * （guard 短路 + F1 跨登入 + 每 mutator happy-path + F2 完整性）。 */
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

  it('guard 短路:已經 hydrate 過就不重覆抓 —— 避免蓋掉本地 join/cancel 直寫的狀態（同 hydrateNotifications 的守衛）', async () => {
    vi.mocked(api).mockResolvedValue([{ id: 'wl-s', course_id: 'course-uuid-7', course_name: '哨兵課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }]);
    await hydrateWaitlist(); // 哨兵經真水合落地、旗標 true(旗標唯讀)
    const sentinel = [{ id: 'wl-s', course_id: 'course-uuid-7', course_name: '哨兵課程' }];
    vi.mocked(api).mockClear();
    vi.mocked(api).mockResolvedValue([
      { id: 'wl-x', course_id: 'course-uuid-6', course_name: '不該出現', status: 'waiting', created_at: '2026-07-04T00:00:00Z' }
    ]);

    await hydrateWaitlist();

    expect(api).not.toHaveBeenCalled();
    expect(get(waitlist)).toEqual(sentinel); // 未被覆寫
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
    }, CART_DEFAULTS));

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

  it('P1′(mutator):join 在飛登出 → 棄寫不落地,回傳值仍交付(mutate 契約:server 端事實已成立)', async () => {
    /* 薄 happy-path 釘只證明「join 成功時 prepend」，證明不了 joinWaitlist 仍委派
     * gate.write——若被誤改成「直接 await api + store 直寫」，這條釘與
     * session-gate.test 的泛型 mutate 釘會兩邊皆綠，但跨帳號資料仍會落地。 */
    const deferred = createDeferred<unknown>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /waitlist/me': [
        { id: 'wl-existing', course_id: 'course-uuid-1', course_name: 'A 既有候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
      ],
      'POST /waitlist': () => deferred.promise
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    await hydrateWaitlist(); // A 已水合,store 非空
    expect(get(waitlist)).toHaveLength(1);

    const p = joinWaitlist('course-uuid-9'); // A 的 POST 掛起中
    await authStore.logout(); // 在飛期間登出 → epoch 變更,reset 已清空 store

    deferred.resolve({ id: 'wl-a', course_id: 'course-uuid-9', course_name: 'A 的候補課程', status: 'waiting', created_at: '2026-07-04T00:00:00Z' });
    const entry = await p; // server 端已成立,回傳值照舊交付(mutate 契約)

    expect(entry.id).toBe('wl-a');
    expect(get(waitlist)).toEqual([]); // 棄寫:新列不落地,舊列也沒有復活——維持 reset 後狀態
    expect(get(waitlistHydrated)).toBe(false); // 不翻旗——B 的 hydrate 照常真抓
  });

  it('後端 409（重複候補）原樣拋出，不寫入 store', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(409, 'already on waitlist'));

    await expect(joinWaitlist('course-uuid-9')).rejects.toBeInstanceOf(ApiError);
    expect(get(waitlist)).toEqual([]);
  });

  it('F2 完整性釘:未 hydrate 直接 joinWaitlist → 和解重抓收斂為完整 server 清單(含既有列),旗標 true,之後 hydrate 被 guarded() 短路', async () => {
    /* 寫入當下旗標 false（從未 hydrate）→ 本地只有直寫那筆,server 既有列缺席;
     * 而寫入的翻旗會讓 guarded() 從此短路——沒有和解重抓,既有列
     * 永不補回。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /waitlist': { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
      'GET /waitlist/me': [
        { id: 'wl-new', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-04T00:00:00Z' },
        { id: 'wl-old', course_id: 'course-uuid-1', course_name: '既有候補課程', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
      ]
    }, CART_DEFAULTS));

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

  it('P1′(mutator):cancel 在飛登出 → 棄寫不落地,同 id canary 原封不動(mutator 回傳值本為 void,只斷言不寫回)', async () => {
    /* 薄 happy-path 釘只證明「cancel 成功時從 store 移除」，證明不了 cancelWaitlist
     * 仍委派 gate.write——理由同 joinWaitlist 上方的 P1′(mutator)釘。不可證偽補強
     * (帳本閉合輪 R3):登出後 store 已被 reset 清空,若直接斷言 toEqual([]),繞過
     * gate.write、直接 await api 後 filter 空陣列的壞實作一樣得 []——斷言恆真、
     * 抓不到退化。改在登出後、resolve 前植入一筆「B session 的 canary」,id 與在飛
     * cancel 的目標同(wl-1,模擬 B 剛好也載入了同 id 資料);正確實作核對 epoch 後
     * 棄寫、canary 原封不動,壞實作的 filter 會把它濾掉。 */
    const deferred = createDeferred<undefined>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /waitlist/me': [
        { id: 'wl-1', course_id: 'course-uuid-9', course_name: '課程A', status: 'waiting', created_at: '2026-07-01T00:00:00Z' }
      ],
      'DELETE /waitlist/wl-1': () => deferred.promise
    }, CART_DEFAULTS));

    await authStore.login('a@dreamfly.test', 'pw');
    await hydrateWaitlist(); // A 已水合,store 含 wl-1
    expect(get(waitlist)).toHaveLength(1);

    const p = cancelWaitlist('wl-1'); // A 的 DELETE 掛起中
    await authStore.logout(); // 在飛期間登出 → epoch 變更,reset 已清空 store

    const canary = { id: 'wl-1', course_id: 'course-uuid-1', course_name: 'B 的候補課程' };
    waitlist.set([canary]); // B session 的資料(同 id)——正確實作應保它不動

    deferred.resolve(undefined);
    await p;

    expect(get(waitlist)).toEqual([canary]); // canary 原封不動:繞過 gate.write 直寫會被 filter 濾掉 → 紅
    expect(get(waitlistHydrated)).toBe(false); // 不翻旗
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
