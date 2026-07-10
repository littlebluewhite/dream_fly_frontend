import { writable, derived, get, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import { NOTIFS_SEED, mapNotification, type ApiNotification, type Notification } from './data';

/* ---- Notifications ---- */
export const notifications = writable<Notification[]>(NOTIFS_SEED.map((n) => ({ ...n })));
export const unreadCount: Readable<number> = derived(notifications, ($n) =>
  $n.filter((n) => !n.read).length
);
// True once the notifications feed has been hydrated via getNotifications() on
// the first client mount; lets re-visits skip re-seeding so read-state (and the
// unread badge) survive navigation. Independent of `notifications`/`unreadCount`
// so it never affects the badge. Resettable in tests.
export const notificationsHydrated = writable(false);

/** 通知中心 — 從 GET /notifications 重新 hydrate(Task 17)。目前的呼叫端是
 *  api.ts 的 getDashboard()：會員登入後第一個會進的頁面，讓 Topbar/Sidebar 的未讀
 *  角標一開始就是真資料，不用等使用者先逛過通知頁。守衛跟 notifications 頁的
 *  load() 用同一顆 notificationsHydrated flag——已經 hydrate 過就不重覆抓，避免
 *  蓋掉使用者在通知頁的本地已讀狀態（不論是哪一邊先觸發都一樣：先到者 hydrate、
 *  後到者直接讀已經在 store 裡的資料）。type→cat/icon/tone 對照表跟 api.ts 的
 *  getNotifications() 共用 data.ts 的 mapNotification，避免兩處各自維護一份。 */
export async function refreshNotifications(): Promise<void> {
  if (get(notificationsHydrated)) return;
  const list = await api<ApiNotification[]>('/notifications');
  if (get(notificationsHydrated)) return; // mutation 勝出，放棄覆寫
  notifications.set(list.map(mapNotification));
  notificationsHydrated.set(true);
}
