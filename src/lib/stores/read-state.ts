/* Dream Fly — 跨 surface 通知已讀狀態 factory;標準極性 read(canonical 行銷站
 * notificationsStore 依 ADR 0004 不在此範圍)。 */

import { writable, type Writable } from 'svelte/store';

/** seed 在建 store 時逐筆 clone(`{ ...item }`)——內部狀態與外部傳入的陣列/物件
 *  互不共享參考。`markRead`/`markAllRead` 一律不可變更新(map 產新陣列 + 新物件);
 *  `id` 是選填(mobile-admin 的 AdminNotif 沒有 id 欄位),markRead 對無 id 的項目
 *  天然找不到命中、no-op——不需要另外判斷。 */
export function createReadState<T extends { id?: string; read: boolean }>(
	seed: T[]
): {
	subscribe: Writable<T[]>['subscribe'];
	set: (items: T[]) => void;
	markRead: (id: string) => void;
	markAllRead: () => void;
} {
	const { subscribe, update, set } = writable<T[]>(seed.map((item) => ({ ...item })));
	return {
		subscribe,
		set,
		markRead(id: string) {
			update((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
		},
		markAllRead() {
			update((items) => items.map((item) => ({ ...item, read: true })));
		}
	};
}

/** 純函式:回傳 `read === false` 的筆數(TabBar/首頁鈴鐺等 badge 用)。 */
export function unreadCount(items: { read: boolean }[]): number {
	return items.filter((item) => !item.read).length;
}
