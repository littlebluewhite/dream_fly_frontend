/* Dream Fly — member/notifications.ts 接線單測:GET /notifications 映射、markRead/markAllRead
 * 的 PATCH 佈線與樂觀更新、頁面進場包的接線。閘門協定(guard 短路、在飛作廢、mutation 勝出、
 * 和解重抓、換身分重置)的釘子住 hydration-gate.test.ts / session-gate.test.ts,本檔不重釘。
 *
 * 只替換 $lib/api/client 的 api()。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { createLoadGate } from '$lib/load-gate';
import { notifications, notificationsPageEntry, markRead, markAllRead, hydrateNotifications } from './notifications';
import { mapNotification } from './data';
import type { NotificationResponse, NotificationType } from '$lib/api/generated';
import { NOTIFS_SEED } from '$lib/testing/seed-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';

/** GET /notifications 的後端形狀（NotificationResponse），只填 mapNotification 會讀到的欄位。
 *  id 預設 'n1'(既有呼叫端沿用);settle 測試(移植自 mobile)需要區分多筆,顯式傳入。 */
function apiNotif(read: boolean, id = 'n1'): NotificationResponse {
  return {
    id, type: 'system', title: '系統公告', message: '內容',
    is_read: read, metadata: null, created_at: '2026-01-01T00:00:00Z'
  };
}

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(async () => {
  vi.mocked(api).mockReset();
  vi.mocked(api).mockResolvedValue(undefined);
  // 夾具: n1–n3 未讀、n4–n6 已讀（見 $lib/testing/seed-fixtures 的 NOTIFS_SEED）。
  await resetSessionStores(); // 登入→登出走一圈讓閘門回開機態(內容還原 []),再鋪夾具
  notifications.set(NOTIFS_SEED.map((n) => ({ ...n })));
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
    // type 收 string 再 cast：n7 模擬部署落差(NotificationType 已封閉,後端先送出新值)。
    const make = (id: string, type: string): NotificationResponse => ({ id, type: type as NotificationType, title: 't-' + id, message: 'm-' + id, is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' });
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

describe('hydrateNotifications — GET /notifications', () => {
  it('把 GET /notifications 映射後寫入 notifications store', async () => {
    vi.mocked(api).mockResolvedValue([
      { id: 'n1', type: 'order_placed', title: '付款成功', message: '訂單已完成付款', is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' }
    ]);

    await hydrateNotifications();

    expect(api).toHaveBeenCalledWith('/notifications');
    expect(get(notifications)).toEqual([
      { id: 'n1', cat: 'order', icon: 'credit-card', tone: 'success', title: '付款成功', body: '訂單已完成付款', time: '2026-07-04 06:30', read: false }
    ]);
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
});

// 接線釘:markRead 繞過 gate.write()(不入尾流帳)的話,PATCH 還在飛時頁面 refresh 的 GET 會搶先出發。
describe('markRead 的閘門接線', () => {
  it('PATCH 未 settle → 頁面 refresh 的 GET 不出發;settle 後才出發', async () => {
    vi.mocked(api).mockResolvedValueOnce([apiNotif(false)]);
    await hydrateNotifications(); // 先水合:本釘只看 refresh 等待,不看和解
    let release!: () => void;
    const patch = new Promise<void>((r) => { release = r; });
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /notifications': () => { gets += 1; return [apiNotif(true)]; },
      'PATCH /notifications/n1/read': () => patch
    }));
    const page = createLoadGate({ ...notificationsPageEntry });

    const readP = markRead('n1');
    const refreshP = page.refresh();
    await new Promise((r) => setTimeout(r, 0));
    expect(gets).toBe(0);

    release();
    await Promise.all([readP, refreshP]);
    expect(gets).toBe(1);
    expect(get(notifications).find((n) => n.id === 'n1')?.read).toBe(true);
    page.destroy();
  });
});

describe('markAllRead', () => {
  it("無未讀 → 回 'ok' 且不送任何請求", async () => {
    notifications.set(NOTIFS_SEED.map((n) => ({ ...n, read: true })));
    vi.mocked(api).mockClear();

    expect(await markAllRead()).toBe('ok');

    expect(api).not.toHaveBeenCalled();
  });

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
});

describe('notificationsPageEntry(C3 接線釘)', () => {
  // 進場包本身的語意(epoch 核對、stale → error、retry、spread 進 load-gate)由
  // session-gate.test.ts 的 pageEntry describe 單源覆蓋——這裡只釘「通知頁拿到的是本模組
  // 這顆閘門」的薄採用面:頁面 load 與 hydrateNotifications 共用同一顆閘門(接錯閘門會讓
  // 頁面的 load-once 守衛失聯),水合過後再進頁不再打 GET。
  it('頁面 load 後第二次 load 不打 GET(與 hydrateNotifications 同一顆閘門)', async () => {
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /notifications': () => { gets += 1; return [apiNotif(false)]; }
    }));
    const page = createLoadGate({ ...notificationsPageEntry });

    await page.load();
    expect(gets).toBe(1);
    await hydrateNotifications();
    expect(gets).toBe(1); // hydrateNotifications 與頁面 load 共用同一顆旗標

    const second = createLoadGate({ ...notificationsPageEntry });
    await second.load();
    expect(gets).toBe(1); // 守衛短路:同一顆旗標
    expect(get(second)).toBe('ready');

    page.destroy();
    second.destroy();
  });
});
