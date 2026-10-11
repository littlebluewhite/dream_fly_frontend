/* Dream Fly — public/marketing surface notifications store。
 * 來源為 GET /posts（見 lib/public/api.ts），過濾 category==='announcement'
 * 並轉為 Notification 形狀；經水合閘門由根 layout 暖機（見下方 announcementsGate）。 */

import { writable, derived } from 'svelte/store';
import type { Notification } from '$lib/types';
import { listPosts } from '$lib/public/api';
import { createHydrationGate } from '$lib/hydration-gate';
import type { PostResponse } from '$lib/api/generated';

/** 公開公告貼文 → 通知形狀。公開端點沒有已讀狀態，一律預設未讀。 */
export function toAnnouncement(p: PostResponse): Notification {
  return {
    id: p.id,
    type: 'announcement',
    title: p.title,
    message: p.excerpt ?? '',
    timestamp: p.published_at ?? p.created_at,
    read: false
  };
}

/** 公告清單本體。寫入只經水合閘門（apply／reset），不對外暴露 set。 */
const announcements = writable<Notification[]>([]);

/** 公告水合閘門（R20）：import 時不再打 GET /posts，由根 layout 的暖機清單呼叫
 *  hydrateAnnouncements。抓取失敗要 throw（不吞成空清單），閘門才會維持「未水合」，
 *  下次暖機可以重試；已水合則短路、不重抓。公開端點與身分無關，故不用 session 閘門。 */
const announcementsGate = createHydrationGate({
  fetch: async () => {
    const posts = await listPosts();
    return posts.filter((p) => p.category === 'announcement').map(toAnnouncement);
  },
  apply: (list) => announcements.set(list),
  reset: () => announcements.set([])
});
export const hydrateAnnouncements = announcementsGate.hydrate;
/** 測試出口：閘門還原開機態（內容回 [] + 旗標 + 在飛 GET）。production 不得引用。 */
export const resetAnnouncementsForTests = announcementsGate.reset;

// Create the notifications store
function createNotificationsStore() {
  const { subscribe, update } = announcements;

  return {
    subscribe,

    markAsRead: (notificationId: string) => {
      update((notifications) =>
        notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    },

    markAllAsRead: () => {
      update((notifications) => notifications.map((n) => ({ ...n, read: true })));
    },

    clearNotification: (notificationId: string) => {
      update((notifications) => notifications.filter((n) => n.id !== notificationId));
    },

    addNotification: (notification: Notification) => {
      update((notifications) => [notification, ...notifications]);
    }
  };
}

export const notificationsStore = createNotificationsStore();

// Derived store for unread announcements（原名 unreadCount，與 member／read-state 的同名匯出區分）
export const unreadAnnouncements = derived(notificationsStore, ($notifications) =>
  $notifications.filter((n) => !n.read).length
);
