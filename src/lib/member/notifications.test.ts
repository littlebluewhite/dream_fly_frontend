/* Dream Fly — member/notifications.ts 單測（C1：markRead/markAllRead 從
 * routes/member/notifications/+page.svelte 搬遷進模組後的單元測試）。
 *
 * refreshNotifications/notificationsHydrated 的 gate 語意（guard 短路、post-await
 * re-check、翻旗）已由 checkout-api.test.ts 的「refreshNotifications(Task 17)」
 * 三個 it 與 hydration-gate.test.ts 的 createHydrationGate 單測覆蓋——本檔案只補
 * markRead/markAllRead 這兩個新 export 的模組層測試，與 routes/member/notifications/
 * page.test.ts 既有的頁面測試並存、是模組層的第二層覆蓋（樂觀更新、PATCH 佈線、
 * 失敗不回滾、allSettled 部分失敗回 'partial'）。
 *
 * 只替換 $lib/api/client 的 api()。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { createLoadGate } from '$lib/load-gate';
import { notifications, notificationsHydrated, notificationsPageEntry, markRead, markAllRead } from './notifications';
import { NOTIFS_SEED } from './data';

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers（同
 *  leave-requests-api.test.ts / load-gate.test.ts 的慣用式）。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** GET /notifications 的後端形狀（ApiNotification），只填 mapNotification 會讀到的欄位。 */
function apiNotif(read: boolean) {
  return {
    id: 'n1', type: 'system', title: '系統公告', message: '內容',
    is_read: read, metadata: null, created_at: '2026-01-01T00:00:00Z'
  };
}

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
  // seed: n1–n3 未讀、n4–n6 已讀（見 $lib/domain/member-app 的 NOTIFS_SEED）。
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
  notificationsHydrated.set(false);
});

describe('markRead', () => {
  it('樂觀更新 store 後送 PATCH /notifications/{id}/read', async () => {
    await markRead('n1');

    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true);
    expect(api).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  it('PATCH 失敗只記錄錯誤，樂觀更新的已讀狀態不還原', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockRejectedValue(new Error('network error'));

    await markRead('n1');

    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true);
  });

  it('呼叫 gate.markMutated()——把 notificationsHydrated 設為 true', async () => {
    expect(get(notificationsHydrated)).toBe(false);

    await markRead('n1');

    expect(get(notificationsHydrated)).toBe(true);
  });
});

describe('markAllRead', () => {
  it('對每個未讀通知各發一次 PATCH(已讀的不重發)，全部成功回 \'ok\'', async () => {
    const result = await markAllRead();

    expect(result).toBe('ok');
    const patchCalls = vi.mocked(api).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH');
    expect(patchCalls.map(([path]) => path).sort()).toEqual([
      '/notifications/n1/read',
      '/notifications/n2/read',
      '/notifications/n3/read'
    ]);
    expect(get(notifications).every((n) => n.read)).toBe(true);
  });

  it('任一 PATCH 失敗回 \'partial\'，本地已讀狀態不還原', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path === '/notifications/n2/read') throw new Error('network error');
      return undefined;
    });

    const result = await markAllRead();

    expect(result).toBe('partial');
    expect(get(notifications).every((n) => n.read)).toBe(true);
  });

  it('呼叫 gate.markMutated()——把 notificationsHydrated 設為 true', async () => {
    expect(get(notificationsHydrated)).toBe(false);

    await markAllRead();

    expect(get(notificationsHydrated)).toBe(true);
  });

  it("無未讀時零 PATCH 仍回 'ok',且零記帳——pendingSettle 同步回 undefined(不為「無事可做」讓 refresh 族多等三個 microtask)", async () => {
    /* 空集路徑本來就無事可做:不樂觀更新、不入帳、不 allSettled。舊碼照樣入一筆空尾流,
     * 同拍呼叫的頁面 refresh 因此要等 allSettled([]) 的三個 microtask 才出發 GET —— 純粹
     * 是時序雜訊。這裡在 await 之前同步取讀尾流帳,才照得到那筆空帳(await 之後帳已歸零)。 */
    notifications.set(NOTIFS_SEED.map((n) => ({ ...n, read: true })));

    const p = markAllRead();
    expect(notificationsPageEntry.hydrate.pendingSettle?.()).toBeUndefined();

    expect(await p).toBe('ok');
    expect(api).not.toHaveBeenCalled();
  });
});

describe('notificationsPageEntry(C3 接線釘)', () => {
  // 進場包本身的語意(epoch 核對 fetch、stale reject、retry、spread 進 load-gate)
  // 由 session-gate.test.ts 的 pageEntry describe 單源覆蓋——這裡只釘「通知頁拿到的
  // 是本模組這顆閘門」:旗標同實例(接錯閘門會讓頁面的 load-once 守衛失聯)、fetch
  // 是可呼叫的函式。
  it('hydrate.flag 與 notificationsHydrated 同一實例、fetch 為函式', () => {
    expect(notificationsPageEntry.hydrate.flag).toBe(notificationsHydrated);
    expect(typeof notificationsPageEntry.fetch).toBe('function');
  });

  /* R10:進場包再帶 hydrate.gen（閘門的 mutationGen），頁面 load-gate 的 refresh 族
   * 因此獲得世代穩定重抓。這裡釘的是「通知頁重新整理在飛時點已讀，已讀不回退」——
   * 舊碼的 applyRefreshed 無條件套用，姍姍來遲的舊快照(server 端仍未讀)會把剛剛的
   * 樂觀已讀打回未讀。 */
  it('頁面 load-gate 的 refresh 在飛期間 markRead → 已讀不回退,舊快照丟棄並原地重抓(GET×2)', async () => {
    const d = createDeferred<unknown[]>();
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /notifications': () => (++gets === 1 ? d.promise : [apiNotif(true)]),
      'PATCH /notifications/n1/read': undefined
    }));

    const page = createLoadGate({ ...notificationsPageEntry });
    const p = page.refresh(); // 使用者按「重新整理」/retry — 顯式新鮮度
    await markRead('n1'); // 飛行窗口內點已讀 → 樂觀更新 + markMutated
    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true);

    d.resolve([apiNotif(false)]); // 舊快照:server 端當時仍未讀
    await p;

    expect(gets).toBe(2); // 舊快照丟棄後補抓
    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true); // 已讀不回退

    page.destroy();
  });

  /* R11(第五決策點:mutation settle 訊號)。上一條釘的是「GET 已落地、之後才 markMutated」
   * 的世代軸;這一條釘的是 ADR 0020 誠實界線記載的另一半——markRead 是 mark-before-await
   * (先寫 store、markMutated,才 await PATCH)。舊碼的 refresh 只看世代穩定,對「PATCH 還在
   * 飛」是盲的:GET 在 PATCH 落庫前出發 → server 回未讀、而世代此刻已穩定 → 舊快照照套,
   * 已讀被打回未讀。現在 refresh 族先等尾流 settle 才出發。 */
  it('mutation settle:markRead 的 PATCH 未 settle → 頁面 refresh 的 GET 不出發;PATCH settle 後才出發,已讀不回退', async () => {
    const patch = createDeferred<unknown>();
    let gets = 0;
    let serverRead = false; // 後端真相:PATCH 落庫後才翻已讀
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /notifications': () => { gets += 1; return [apiNotif(serverRead)]; },
      'PATCH /notifications/n1/read': () => patch.promise
    }));

    const page = createLoadGate({ ...notificationsPageEntry });
    const readP = markRead('n1'); // 樂觀已讀 + markMutated(尾流)
    const refreshP = page.refresh(); // 使用者同時按「重新整理」
    await new Promise((r) => setTimeout(r, 0));

    expect(gets).toBe(0); // PATCH 仍在飛 → GET 一律不出發(server-race 窗關閉)

    serverRead = true;
    patch.resolve(undefined);
    await Promise.all([readP, refreshP]);

    expect(gets).toBe(1); // 尾流 settle 才出發,而且只出發一次(世代已穩定,無補抓)
    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true); // 已讀不回退

    page.destroy();
  });
});
