/* Dream Fly — public/marketing surface notifications store。
 * 來源自本任務起改為 GET /posts（見 lib/public/api.ts），過濾 category==='announcement'
 * 並轉為 Notification 形狀 —— store 對外的 subscribe/markAsRead/... API 不變。 */

import { writable, derived } from 'svelte/store';
import type { Notification } from '$lib/types';
import { listPosts, type ApiPost } from '$lib/public/api';

/** 公開公告貼文 → 通知形狀。公開端點沒有已讀狀態，一律預設未讀。 */
export function toAnnouncement(p: ApiPost): Notification {
  return {
    id: p.id,
    type: 'announcement',
    title: p.title,
    message: p.excerpt ?? '',
    timestamp: p.published_at ?? p.created_at,
    read: false
  };
}

async function loadNotifications(): Promise<Notification[]> {
  if (typeof window === 'undefined') return [];

  try {
    const posts = await listPosts();
    return posts.filter((p) => p.category === 'announcement').map(toAnnouncement);
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return [];
  }
}

// Create the notifications store
function createNotificationsStore() {
  const { subscribe, set, update } = writable<Notification[]>([]);

  // Initialize with notifications
  if (typeof window !== 'undefined') {
    loadNotifications().then((notifications) => {
      set(notifications);
    });
  }

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

// Derived store for unread count
export const unreadCount = derived(notificationsStore, ($notifications) =>
  $notifications.filter((n) => !n.read).length
);
