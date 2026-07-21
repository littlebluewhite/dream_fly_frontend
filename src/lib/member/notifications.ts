import { writable, derived, get, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import { createSessionGate } from '$lib/session-gate';
import { NOTIFS_SEED, mapNotification, type ApiNotification, type Notification } from './data';

/* ---- Notifications ---- */
export const notifications = writable<Notification[]>(NOTIFS_SEED.map((n) => ({ ...n })));
export const unreadCount: Readable<number> = derived(notifications, ($n) =>
  $n.filter((n) => !n.read).length
);

/** 通知中心 — 從 GET /notifications 重新 hydrate(Task 17；C1 架構深化 R7 改用共用的
 *  createSessionGate)。目前的呼叫端是 api.ts 的 getDashboard()：會員登入後第一個會進
 *  的頁面，讓 Topbar/Sidebar 的未讀角標一開始就是真資料，不用等使用者先逛過通知頁。
 *  守衛跟 notifications 頁的 load() 用同一顆 notificationsHydrated flag——已經 hydrate
 *  過就不重覆抓，避免蓋掉使用者在通知頁的本地已讀狀態（不論是哪一邊先觸發都一樣：先到者
 *  hydrate、後到者直接讀已經在 store 裡的資料）。type→cat/icon/tone 對照表跟 api.ts 的
 *  getNotifications() 共用 data.ts 的 mapNotification，避免兩處各自維護一份。gate.refresh
 *  不匯出——通知域目前沒有「無視守衛強制重抓」的消費者(YAGNI)。
 *  C1 抬升(修跨登入洩漏):原本 notificationsHydrated 旗標跨帳號存活是真缺陷——SPA 登出
 *  無整頁重載,B 帳號的 getDashboard 觸發的 refreshNotifications 被 guarded() 短路,直接
 *  讀到 A 的通知。改走 createSessionGate 後,identity 變更即 reset(旗標翻 false + 通知
 *  重置為 seed)、換帳後重抓真資料;reset 用 NOTIFS_SEED clone(boot 態,badge teaser 保留,
 *  restored session 開機立即回呼值冪等)。殘留 known-latent(通知**頁**的 load-gate 入口
 *  仍無 identity epoch;之後記 ADR 0017,不在本輪)。 */
const gate = createSessionGate<Notification[]>({
  fetch: async () => {
    const list = await api<ApiNotification[]>('/notifications');
    return list.map(mapNotification);
  },
  apply: (list) => notifications.set(list),
  reset: () => notifications.set(NOTIFS_SEED.map((n) => ({ ...n }))) // boot 態 = seed clone(值冪等)
});
// True once the notifications feed has been hydrated via getNotifications() on
// the first client mount; lets re-visits skip re-seeding so read-state (and the
// unread badge) survive navigation. Independent of `notifications`/`unreadCount`
// so it never affects the badge. Resettable in tests. Same writable instance as
// gate.hydrated(hydration-gate.ts 的介面明文：呼叫端可直接讀寫，非唯讀投影)。
export const notificationsHydrated = gate.hydrated;
export const refreshNotifications = gate.hydrate;

/** 已讀 mutation(自 routes/member/notifications/+page.svelte 搬遷，C1)——樂觀更新
 *  本地 store，再送 PATCH 到後端；失敗只記錄錯誤、不還原(避免使用者感覺「點了又
 *  跳回未讀」的閃爍)。呼叫 gate.markMutated() 讓 in-flight 的 refreshNotifications()
 *  (若有)不會拿姍姍來遲的舊資料蓋掉這筆已讀 mutation(同 hydration-gate.ts 的
 *  post-await re-check 語意)。toast 留在頁面——本模組不碰 toast。 */
export async function markRead(id: string): Promise<void> {
  notifications.update((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  gate.markMutated();
  try {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
  }
}

/** 全部已讀：同 markRead 的樂觀更新，但後端只有單筆 PATCH 端點(無批次已讀)，對每個
 *  「目前未讀」的 id 各發一次(allSettled 併發；已讀的不重發)。全部成功回 'ok'；
 *  任何失敗回 'partial'——本地已讀狀態一律不還原(與 markRead 的不閃爍原則一致；
 *  成功的那些後端已落地，失敗的重新整理後會恢復未讀)。呼叫端(頁面)依回傳值決定
 *  toast 文案，本模組不碰 toast。 */
export async function markAllRead(): Promise<'ok' | 'partial'> {
  const unreadIds = get(notifications).filter((n) => !n.read).map((n) => n.id);
  notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  gate.markMutated();
  const results = await Promise.allSettled(
    unreadIds.map((id) => api(`/notifications/${id}/read`, { method: 'PATCH' }))
  );
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length > 0) {
    failures.forEach((f) => console.error('Failed to mark notification as read:', f.reason));
    return 'partial';
  }
  return 'ok';
}
