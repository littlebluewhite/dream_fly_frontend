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
import { notifications, notificationsHydrated, markRead, markAllRead } from './notifications';
import { NOTIFS_SEED } from './data';

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
});
