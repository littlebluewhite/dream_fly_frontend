import { writable, derived } from 'svelte/store';
import type { Notification } from '$lib/types';

// Load sample notifications from JSON
async function loadNotifications(): Promise<Notification[]> {
  if (typeof window === 'undefined') return [];

  try {
    const response = await fetch('/data/notifications.json');
    if (!response.ok) throw new Error('Failed to fetch notifications');
    return await response.json();
  } catch (error) {
    console.error('Failed to load notifications:', error);
    // Return default notifications if fetch fails
    return [
      {
        id: 'notif-001',
        type: 'reminder',
        title: '課程提醒',
        message: '您的幼兒體操課程將在明天下午2點開始',
        timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
        read: false
      },
      {
        id: 'notif-002',
        type: 'promotion',
        title: '限時優惠',
        message: '本月競技啦啦隊課程享20%折扣！',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        read: false
      },
      {
        id: 'notif-003',
        type: 'schedule',
        title: '課程調整',
        message: '成人體操課程時間已調整',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        read: true
      }
    ];
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
