/* Dream Fly — member/notifications.ts 單測（C1：markRead/markAllRead 從
 * routes/member/notifications/+page.svelte 搬遷進模組後的單元測試）。
 *
 * hydrateNotifications/notificationsHydrated 的 gate 語意（guard 短路、post-await
 * re-check、翻旗）已由 checkout-api.test.ts 的「hydrateNotifications(Task 17)」
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
import { mapNotification } from './data';
import { NOTIFS_SEED } from '$lib/testing/seed-fixtures';
// Task 5(架構深化 R12):跨帳號 session 重置的「無登出直接換帳號」釘,自
// mobile/notifications.test.ts 移植(mobile module 併入本檔前的獨有覆蓋,見
// task-5-report.md)。用真 authStore.login 驅動 identity。
import { authStore } from '$lib/stores/authStore';

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers（同
 *  leave-requests-api.test.ts / load-gate.test.ts 的慣用式）。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** GET /notifications 的後端形狀（ApiNotification），只填 mapNotification 會讀到的欄位。
 *  id 預設 'n1'(既有呼叫端沿用);settle 測試(移植自 mobile)需要區分多筆,顯式傳入。 */
function apiNotif(read: boolean, id = 'n1') {
  return {
    id, type: 'system', title: '系統公告', message: '內容',
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
  // 夾具: n1–n3 未讀、n4–n6 已讀（見 $lib/testing/seed-fixtures 的 NOTIFS_SEED）。
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
  notificationsHydrated.set(false);
});

// R14(候選 F3)誠實開機:開機值 = reset 值 = `[]`——角標在暖機前是 0(UI 在 0 時本來就
// 隱藏),不再顯示種子裡的假 3 則。重新載入模組才照得到「開機」那一刻的值(本檔其他 it
// 都會先 set 夾具)。
describe('誠實開機(R14 F3)', () => {
  it('模組開機時 notifications 為 [],unreadCount 為 0', async () => {
    vi.resetModules();
    const fresh = await import('./notifications');
    expect(get(fresh.notifications)).toEqual([]);
    expect(get(fresh.unreadCount)).toBe(0);
  });
});

// Task 5(架構深化 R12):member/api.ts 的 getNotifications() 因零 production 消費者
// (mobile 併入前是唯一的另一個呼叫端)退役,連帶移除的 member/api.test.ts「getNotifications」
// 區塊原本是 mapNotification type→cat/icon/tone 對照表(含未知值 fallback)唯一的覆蓋——
// mapNotification 本身沒退役(本模組的 gate.fetch 仍在用),搬到這裡測「深化後的介面」
// (直接測 mapNotification,不透過已退役的 wrapper),不留覆蓋空窗。
describe('mapNotification(自 member/api.test.ts 移入,原 getNotifications() 退役後改在此覆蓋)', () => {
  it('type→cat/icon/tone 對照表涵蓋所有後端型別，含未知值 fallback', () => {
    const make = (id: string, type: string) => ({ id, type, title: 't-' + id, message: 'm-' + id, is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' });
    const list = [
      make('n1', 'booking_confirmed'),
      make('n2', 'booking_cancelled'),
      make('n3', 'order_placed'),
      make('n4', 'order_status'),
      make('n5', 'system'),
      make('n6', 'promotion'),
      make('n7', 'brand_new_unknown_type')
    ].map(mapNotification);

    expect(list.map((n) => [n.cat, n.icon, n.tone])).toEqual([
      ['class', 'calendar-check', 'success'],
      ['class', 'calendar-off', 'warning'],
      ['order', 'credit-card', 'success'],
      ['order', 'rotate-cw', 'info'],
      ['system', 'bell', 'neutral'],
      ['system', 'megaphone', 'accent'],
      ['system', 'bell', 'neutral'] // 未知型別 fallback，不因後端新增 enum 值而炸掉
    ]);
  });

  it('id/title/message/is_read 直接映射；time 取 created_at 的 YYYY-MM-DD HH:mm', () => {
    const n = mapNotification({ id: 'n9', type: 'system', title: '標題', message: '內容', is_read: true, metadata: null, created_at: '2026-07-04T06:30:00Z' });
    expect(n).toEqual({ id: 'n9', cat: 'system', icon: 'bell', tone: 'neutral', title: '標題', body: '內容', time: '2026-07-04 06:30', read: true });
  });
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

// Task 5(架構深化 R12·候選 02)：以下兩個 describe 移植自
// mobile/notifications.test.ts(併入前的獨有覆蓋)——member 側原本沒有「無登出
// 直接換帳號」與「markAllRead 的 allSettled 尾流」這兩條釘。搬遷後 mobile 模組
// 退役，消費端改經 $lib/mobile/stores 轉出同一顆閘門/store(見 task-5-report.md)。
describe('跨帳號 session 重置(移植自 mobile/notifications.test.ts)', () => {
  const AUTH_RES = {
    access_token: 'at-m', refresh_token: 'rt-m',
    user: { id: 'u-m1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false, avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member'] }
  };
  const AUTH_RES_B = { ...AUTH_RES, access_token: 'at-mb', refresh_token: 'rt-mb', user: { ...AUTH_RES.user, id: 'u-m2', email: 'b@dreamfly.test', name: '乙' } };

  beforeEach(async () => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue(undefined); // logout best-effort revoke .catch 安全
    await authStore.logout(); // 每個 it 從登出態起跑:立即回呼身分 null == baseline,不誤觸
    notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
    notificationsHydrated.set(false);
  });

  // P1″ 換帳號釘(移植自 mobile/notifications.test.ts:186)：A hydrate 後 B 直接
  // 登入(無登出)→ identity 變更即 reset,B 不繼承 A 的通知。登出重置本身已由
  // checkout-api.test.ts 的「hydrateNotifications(Task 17)」F1 系列覆蓋,這裡補
  // 的是「無登出邊沿」這條 member 側原本沒釘到的路徑。
  it('A hydrate 後 B 直接登入(無登出)→ identity 變更即 reset,B 不繼承 A 的通知', async () => {
    let logins = 0;
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B) }));

    await authStore.login('a@dreamfly.test', 'pw');
    notifications.set([{ id: 'a1', cat: 'system', icon: 'bell', tone: 'info', title: 'A 的通知', body: '', time: '剛才', read: true }]);
    notificationsHydrated.set(true);

    await authStore.login('b@dreamfly.test', 'pw'); // B 直接登入,無登出邊沿

    expect(get(notificationsHydrated)).toBe(false);
    expect(get(notifications)).toEqual([]); // A 的通知即刻清空為 boot 態 `[]`
  });
});

describe('markAllRead 的 allSettled 尾流(移植自 mobile/notifications.test.ts:218-248)', () => {
  /* markAllRead 是 mark-before-await(先寫 store、markMutated,才 await 那批 PATCH)。
   * 舊碼的 refresh 只看世代穩定,對「PATCH 群還在飛」是盲的:GET 在落庫前出發 → server
   * 回未讀、而世代此刻已穩定 → 舊快照照套,已讀被打回未讀(ADR 0020 誠實界線記載的
   * GET/PATCH server-race)。allSettled 的尾流「含失敗也 settle」,不得因為某一筆 PATCH
   * 失敗就永久卡住 refresh。 */
  beforeEach(() => {
    vi.mocked(api).mockReset();
    notifications.set(NOTIFS_SEED.map((n) => ({ ...n, read: false })).slice(0, 2));
    notificationsHydrated.set(false);
  });

  it('markAllRead 的 PATCH 群未 settle → 頁面 refresh 的 GET 不出發;含失敗的 allSettled settle 後照出發', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const okPatch = createDeferred<unknown>();
    const badPatch = createDeferred<unknown>();
    const [id1, id2] = NOTIFS_SEED.slice(0, 2).map((n) => n.id);
    let gets = 0;
    let serverRead1 = false; // 後端真相:n1 落庫後才翻已讀;n2 的 PATCH 失敗,始終未讀
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /notifications': () => { gets += 1; return [apiNotif(serverRead1, id1), apiNotif(false, id2)]; },
      [`PATCH /notifications/${id1}/read`]: () => okPatch.promise,
      [`PATCH /notifications/${id2}/read`]: () => badPatch.promise
    }));

    const page = createLoadGate({ ...notificationsPageEntry });
    const allP = markAllRead(); // 樂觀全已讀 + markMutated(allSettled 尾流)
    const refreshP = page.refresh(); // 使用者同時按「重新整理」
    await new Promise((r) => setTimeout(r, 0));

    expect(gets).toBe(0); // PATCH 群仍在飛 → GET 一律不出發

    serverRead1 = true;
    okPatch.resolve(undefined);
    badPatch.reject(new Error('network error'));
    const result = await allP;
    await refreshP;

    expect(result).toBe('partial');
    expect(gets).toBe(1); // 尾流(含失敗那筆)settle 後才出發,且只一次
    expect(get(notifications).find((n) => n.id === id1)?.read).toBe(true); // 落庫成功的已讀不回退
    // 已知殘餘(誠實界線):id2 的 PATCH 失敗,重新整理顯示 server 真相(未讀)——這是顯式
    // 新鮮度契約,不是回歸(見 markAllRead 的「失敗不還原」不閃爍原則)。
    expect(get(notifications).find((n) => n.id === id2)?.read).toBe(false);

    page.destroy();
  });
});
