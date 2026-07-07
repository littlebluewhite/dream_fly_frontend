/* Dream Fly — mobile 與 mobile-admin 兩 surface 共用的 overlay 堆疊 factory(單一來源)。
 * 原先兩份 stores.ts(mobile / mobile-admin)各有一份逐字相同的複本,自此單源於本檔;
 * 兩邊 stores 之後改以 re-export 供應既有 import 路徑(overlay 單例仍由各 surface 自建)。 */

import { writable } from 'svelte/store';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
export interface OverlayEntry {
	id: string;
	props: Record<string, unknown>;
}
export interface OverlayState {
	stack: OverlayEntry[];
	sheet: OverlayEntry | null;
}

/** push() / pop() drive the slide-in screen stack; sheet() / closeSheet() drive
 *  the single bottom sheet; closeAll() resets both (called on every tab change so
 *  an open overlay never survives navigation). */
export function createOverlay() {
	const { subscribe, update, set } = writable<OverlayState>({ stack: [], sheet: null });
	return {
		subscribe,
		push(id: string, props: Record<string, unknown> = {}) {
			update((o) => ({ ...o, stack: [...o.stack, { id, props }] }));
		},
		pop() {
			update((o) => ({ ...o, stack: o.stack.slice(0, -1) }));
		},
		sheet(id: string, props: Record<string, unknown> = {}) {
			update((o) => ({ ...o, sheet: { id, props } }));
		},
		closeSheet() {
			update((o) => ({ ...o, sheet: null }));
		},
		closeAll() {
			set({ stack: [], sheet: null });
		}
	};
}
