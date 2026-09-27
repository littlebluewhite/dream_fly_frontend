import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { tick } from 'svelte';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { notifications, notificationsHydrated, toasts } from '$lib/member/stores';
import { NOTIFS_SEED } from '$lib/member/data';
import type { ApiNotification, Notification } from '$lib/member/data';
import Page from './+page.svelte';

// C3:頁面改吃 notificationsPageEntry(session 閘門吐出的進場包),fetch 已收進
// $lib/member/notifications 的閘門內、不再是 $lib/member/api 的 getNotifications——
// mock 點隨之下移到 $lib/api/client,以路徑分流 GET /notifications 與已讀 PATCH。
// 副作用是頁測順帶覆蓋 data.ts 的 mapNotification(fixture 改後端 wire 形)。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/** 後端形狀 fixture(GET /notifications 的原始回應)。type→cat/icon/tone 與
 *  created_at→time 的映射由 mapNotification 負責,渲染結果即映射的活證明。 */
const WIRE: ApiNotification[] = [
  { id: 'n1', type: 'booking_confirmed', title: '明日課程提醒', message: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館。', is_read: false, metadata: null, created_at: '2026-06-10T19:00:00Z' },
  { id: 'n2', type: 'order_placed', title: '報名付款成功', message: '訂單 DF-24061 已完成付款。', is_read: false, metadata: null, created_at: '2026-06-09T12:30:00Z' },
  { id: 'n3', type: '後端新增的未知型別', title: '端午連假停課公告', message: '6/14–6/16 全館停課。', is_read: true, metadata: null, created_at: '2026-06-08T03:05:00Z' }
];

/** GET /notifications 的回應由各測試自行指定;未指定即拋錯(漏設會紅,不靜默放行)。 */
let feed: () => Promise<ApiNotification[]>;
const FEED_UNSET = () => Promise.reject(new Error('測試未指定 GET /notifications 回應'));
/** 本頁只有兩種 api 呼叫:GET /notifications(路徑相等)與 /notifications/{id}/read。 */
const feedCalls = () => vi.mocked(api).mock.calls.filter(([path]) => path === '/notifications').length;

beforeEach(() => {
  vi.mocked(api).mockReset();
  feed = FEED_UNSET;
  vi.mocked(api).mockImplementation(async (path: string) => (path === '/notifications' ? feed() : undefined));
  // toasts 是 4000ms 自動過期的 singleton — 前一個測試的 toast 會殘留到下一個
  // 測試,清掉才能對「某 toast 不得出現」做可靠斷言。
  get(toasts).forEach((t) => toasts.dismiss(t.id));
  // Reset the load-once guard so each test starts un-hydrated. A store (not a
  // module boolean) so test order can't leak a prior successful hydrate.
  notificationsHydrated.set(false);
  // Re-seed the feed so a prior test's set() doesn't bleed through.
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
});

afterEach(() => {
  // Ensure shared store is always restored to seed after each test.
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
  notificationsHydrated.set(false);
});

describe('member/notifications 頁', () => {
  it('先骨架,async 載入後顯示通知(wire 形經 mapNotification 映射:標題/內文/絕對時間)', async () => {
    feed = async () => WIRE.map((n) => ({ ...n }));
    render(Page);
    expect(screen.queryByText('明日課程提醒')).toBeNull();
    expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
    // mapNotification:message→body、created_at→'YYYY-MM-DD HH:mm'。
    expect(screen.getByText('競技啦啦隊 進階班 · 明日 19:00 · A 訓練館。')).toBeInTheDocument();
    expect(screen.getByText('2026-06-10 19:00')).toBeInTheDocument();
  });

  it('點擊通知(標為已讀)會呼叫 PATCH /notifications/{id}/read(Task 17)', async () => {
    notificationsHydrated.set(true); // 直接用 store 裡已有的 seed,略過 load()
    render(Page);
    const row = (await screen.findByText('明日課程提醒')).closest('button')!;

    await fireEvent.click(row);

    expect(api).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  it('全部標為已讀:對每個未讀通知各發一次 PATCH(已讀的不重發),全部成功後顯示成功 toast', async () => {
    // seed:n1–n3 未讀、n4–n6 已讀(見 NOTIFS_SEED)——只有 n1/n2/n3 該被 PATCH。
    notificationsHydrated.set(true);
    render(Page);
    await screen.findByText('明日課程提醒');

    await fireEvent.click(screen.getByRole('button', { name: /全部標為已讀/ }));

    await waitFor(() => {
      const patchCalls = vi.mocked(api).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH');
      expect(patchCalls.map(([path]) => path).sort()).toEqual([
        '/notifications/n1/read',
        '/notifications/n2/read',
        '/notifications/n3/read'
      ]);
      expect(get(toasts).some((t) => t.title === '已全部標為已讀')).toBe(true);
    });
    expect(get(notifications).every((n) => n.read)).toBe(true);
  });

  it('全部標為已讀:任一 PATCH 失敗時改報「部分通知標記失敗」,本地已讀狀態不還原', async () => {
    notificationsHydrated.set(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/notifications/n2/read') throw new Error('network error');
      return undefined;
    });
    render(Page);
    await screen.findByText('明日課程提醒');

    await fireEvent.click(screen.getByRole('button', { name: /全部標為已讀/ }));

    await waitFor(() => {
      expect(get(toasts).some((t) => t.title === '部分通知標記失敗')).toBe(true);
    });
    // 成功 toast 不得同時出現;樂觀更新一律保留(與 markRead 的不閃爍原則一致)。
    expect(get(toasts).some((t) => t.title === '已全部標為已讀')).toBe(false);
    expect(get(notifications).every((n) => n.read)).toBe(true);
  });

  it('PATCH 失敗時只記錄錯誤,樂觀更新的已讀狀態不還原', async () => {
    notificationsHydrated.set(true);
    vi.mocked(api).mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(Page);
    const row = (await screen.findByText('明日課程提醒')).closest('button')!;

    await fireEvent.click(row);
    await tick();

    // 樂觀更新已經套用 —— 該通知的未讀圓點消失(見 notif-row 樣板:!n.read 才畫點)。
    expect(row.querySelector('span[style*="border-radius:50%"]')).toBeNull();
  });

  it('載入失敗顯示 ErrorState', async () => {
    feed = () => Promise.reject(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記(data-testid="notifs-skeleton")', () => {
    let release!: (e: Error) => void;
    feed = () => new Promise((_, rej) => (release = rej));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="notifs-skeleton"]')).not.toBeNull();
    release(new Error('測試收尾')); // R14 F2:合併的在飛 GET 必須 settle,否則下一個測試的 load 會併入這支永不落地的 GET
  });

  it('load-once 守衛:已 hydrate 則重訪不再 fetch、直接 ready', async () => {
    // 模擬「先前已成功載入」:守衛為 true、store 已有資料。
    notificationsHydrated.set(true);
    render(Page);
    // 直接 ready(seed 已在 store),且未再打 GET /notifications → 不覆寫已讀狀態。
    expect(await screen.findByText('明日課程提醒')).toBeInTheDocument();
    expect(feedCalls()).toBe(0);
  });

  it('首次成功載入會把守衛設為 true', async () => {
    feed = async () => WIRE.map((n) => ({ ...n }));
    render(Page);
    await screen.findByText('明日課程提醒');
    expect(get(notificationsHydrated)).toBe(true);
  });

  it('refresh 失敗後重試必須真正重新 fetch 而非被 hydration 守衛短路', async () => {
    // Step 1: 初次載入成功 → hydration 守衛設為 true
    feed = async () => WIRE.map((n) => ({ ...n }));
    render(Page);
    await screen.findByText('明日課程提醒');

    // Step 2: 使用者點「重新整理」，但這次 fetch 失敗
    feed = () => Promise.reject(new Error('network error'));
    await fireEvent.click(screen.getByRole('button', { name: /重新整理/ }));
    await screen.findByText('載入失敗');

    // Step 3: 使用者點 ErrorState 的「重新載入」重試
    // Bug: onRetry={load} 被 hydration 守衛短路，不會再 fetch
    // Fix: onRetry={refresh} 確保一定重新 fetch
    feed = async () => WIRE.map((n) => ({ ...n }));
    await fireEvent.click(screen.getByRole('button', { name: /重新載入/ }));
    await screen.findByText('明日課程提醒');

    // 應打 3 次 GET: 初次載入 + 失敗的 refresh + 重試的 refresh
    expect(feedCalls()).toBe(3);
  });

  it('unmount 後解析的 in-flight fetch 不應覆寫 shared notifications store', async () => {
    // Arrange: deferred promise so we can control when promise A resolves.
    let resolveA!: (value: ApiNotification[]) => void;
    feed = () => new Promise<ApiNotification[]>((r) => { resolveA = r; });

    // Mount: load() fires on mount; promise A is pending (phase=loading).
    const { unmount } = render(Page);

    // Simulate post-remount state: user already marked items read in the store.
    const sentinel: Notification[] = [
      { id: 'sentinel', cat: 'system', icon: 'bell', tone: 'info', title: '哨兵', body: '已讀哨兵', time: '剛才', read: true }
    ];
    notifications.set(sentinel);

    // Unmount the component (simulates navigating away).
    unmount();

    // Now the stale promise A resolves with fresh data.
    resolveA(WIRE.map((n) => ({ ...n })));
    // Flush microtasks so the .then() callback runs.
    await Promise.resolve();
    await tick();

    // The shared store must NOT have been clobbered — sentinel must still be there.
    expect(get(notifications)).toEqual(sentinel);
  });

  // C3 在飛換帳釘(關閉 ADR 0017 的 epoch 殘窗):頁面改吃 notificationsPageEntry 之前,
  // load-gate 的 fetch 是繞過 epoch 核對的 raw getter——跨登出的在飛回應會被無條件
  // 寫進共享 notifications store(B 帳號直接讀到 A 的通知)並收斂為 ready。現在
  // fetch 帶 epoch 核對,過期即 throw,頁面落 error 態、store 不被覆寫。
  it('在飛換帳釘:pending fetch 期間登出 → 舊帳號回應作廢(頁面轉 ErrorState),共享 notifications store 不被 stale 資料覆寫', async () => {
    const AUTH_RES = {
      access_token: 'at-n', refresh_token: 'rt-n',
      user: { id: 'u-n1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false, avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member'] }
    };
    let resolveA!: (value: ApiNotification[]) => void;
    const pending = new Promise<ApiNotification[]>((r) => { resolveA = r; });
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /notifications': () => pending
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    render(Page); // A 的 fetch 掛起中(phase=loading)

    await authStore.logout(); // 在飛期間登出 → 閘門 epoch+1、reset 把 store 歸 boot seed

    resolveA([{ id: 'a-only', type: 'system', title: 'A 帳號的通知', message: '', is_read: true, metadata: null, created_at: '2026-06-01T08:00:00Z' }]);

    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
    expect(screen.queryByText('A 帳號的通知')).toBeNull();
    expect(get(notifications)).toEqual(NOTIFS_SEED); // 舊帳號資料沒有寫進共享 store
  });
});
