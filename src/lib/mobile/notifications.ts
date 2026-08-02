/* Dream Fly — 行動版通知中心(notifs 清單 / unread badge / 已讀 mutation / session 閘門)。
 *
 * C3(架構深化 R9):整段自 `mobile/stores.ts` 搬出成**葉模組**。理由是成環——通知段
 * 改建 createSessionGate 之後需要 fetch(`getNotifications`,來自 `./api`),而 `./api`
 * 反過來 import `./stores` 的 `PREFS_DEFAULT`/`Prefs`;留在 stores.ts 即 stores ⇄ api
 * 成環。搬出後依賴鏈 `notifications → api → stores` 無環。
 *
 * 同一理由:`stores.ts` **不得** re-export 本模組(re-export 會讓
 * `api → stores → notifications → api` 繞回成環)。消費端(TabBar、mobile 首頁、
 * mobile 通知頁)一律直接 `import '$lib/mobile/notifications'`——這與 member 側
 * (經 `member/stores` barrel 轉出)是**刻意的不對稱**。 */

import { derived, get } from 'svelte/store';
import { api } from '$lib/api/client';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import { createSessionGate } from '$lib/session-gate';
import { getNotifications } from './api';
import { NOTIFS_SEED, type Notification as NotifItem } from '$lib/domain/member-app';

// C6:read-flag store 委派共用的 createReadState(見 $lib/stores/read-state,
// mobile 現形即標準極性,行為 1:1)。createNotifs 保留舊名(委派 alias),既有
// 呼叫端(本檔案 notifs 單例)零變動。
export const createNotifs = createReadState;
export { unreadCount };
// 同步 seed(createNotifs 內部 clone;與 member notifications 前例同型):badge
// (unread,TabBar/首頁鈴鐺都讀)一開始就有值。首次造訪通知頁時經 notifsPageEntry
// 水合覆寫一次(見該頁 load()/refresh());閘門旗標是 load-once 守衛,防止重訪重抓
// 覆寫已讀狀態。
const notifsBase = createNotifs<NotifItem>(NOTIFS_SEED);

/** C1(架構深化 R7)抬升 → C3(R9)改建完整閘門:notifsHydrated 原本跨帳號存活是真
 *  缺陷(同 member notifications 前例)——SPA 登出無整頁重載,B 帳號重訪通知頁被
 *  load-gate 判「已水合」而讀到 A 的已讀狀態/通知。R7 用門 (c) onSessionReset 只做
 *  identity 重置(閘門所有權留在本檔的 plain Writable);R9 起改建
 *  createSessionGate,除了同樣的重置之外,還多拿到 epoch 核對 fetch——通知頁經
 *  notifsPageEntry 進場,在飛跨登出/換帳的回應會被作廢,不再無條件寫進共享 store
 *  (ADR 0017 的 known-latent 殘窗)。reset 用 NOTIFS_SEED clone(boot 態,badge
 *  teaser 保留,restored session 開機的立即回呼值冪等)。gate.refresh 不匯出——
 *  通知域沒有「無視守衛強制重抓」的模組層消費者(頁面重試走 load-gate 自己的
 *  refresh,見 pageEntry)。 */
const gate = createSessionGate<NotifItem[]>({
	fetch: getNotifications,
	apply: (list) => notifsBase.set(list),
	reset: () => notifsBase.set(NOTIFS_SEED.map((n) => ({ ...n }))) // boot 態 = seed clone(值冪等)
});
/** 閘門旗標同一實例(hydration-gate.ts 的介面明文:呼叫端可直接讀寫,非唯讀投影)。 */
export const notifsHydrated = gate.hydrated;
/** 通知頁的 load-gate 進場包(fetch 帶 epoch 核對 + hydrate 選項),頁面 spread 使用。 */
export const notifsPageEntry = gate.pageEntry();

/** K2-c 協定補完:markRead/markAllRead 原本完全沒有翻旗協定,mutation 後
 *  notifsHydrated 仍是 false,重訪通知頁會被 load-gate 判定「尚未水合」而整包
 *  重抓、覆寫掉這裡的已讀 mutation。包裝函式在呼叫共用邏輯後翻旗,對齊 member
 *  的 markMutated 協定(見 $lib/member/notifications.ts)。C3 起旗標由閘門擁有,
 *  翻旗改呼叫 gate.markMutated()——它是 `flag.set(true)` 的嚴格超集(多遞增閘門
 *  內部的 mutationGen),走公開協定才不會讓閘門自己的帳本落後於旗標。set() 不繞
 *  這層——水合本身由通知頁的 load-gate hydrate 選項在 into() 之後自己翻旗,不需要
 *  這裡重覆翻。
 *  W1:markRead/markAllRead 原本只翻本地旗、不打後端,重新整理或新 session 會
 *  讓已讀狀態回退成未讀(使用者可見 bug)。現在樂觀更新本地 store 後改送 PATCH
 *  /notifications/{id}/read 落庫;失敗只記錄錯誤、不還原本地狀態(不閃爍原則,
 *  同 $lib/member/notifications.ts 的 markRead/markAllRead 一致)。點擊已讀項
 *  仍會重送 PATCH——端點冪等(同 member 沒有另外擋),不為此加 guard。 */
export const notifs = {
	subscribe: notifsBase.subscribe,
	set: notifsBase.set,
	async markRead(id: string): Promise<void> {
		notifsBase.markRead(id); // 樂觀更新
		gate.markMutated(); // 翻旗(≡ 舊 notifsHydrated.set(true),走閘門公開協定)
		try {
			await api(`/notifications/${id}/read`, { method: 'PATCH' });
		} catch (err) {
			console.error('Failed to mark notification as read:', err); // 不還原(member 不閃爍原則)
		}
	},
	async markAllRead(): Promise<'ok' | 'partial'> {
		const unreadIds = get(notifsBase).filter((n) => !n.read).map((n) => n.id); // 必須在 markAllRead() 前捕捉
		notifsBase.markAllRead();
		gate.markMutated();
		const results = await Promise.allSettled(
			unreadIds.map((id) => api(`/notifications/${id}/read`, { method: 'PATCH' }))
		);
		const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
		failures.forEach((f) => console.error('Failed to mark notification as read:', f.reason));
		return failures.length > 0 ? 'partial' : 'ok';
	}
};
export const unread = derived(notifs, ($n) => unreadCount($n));
