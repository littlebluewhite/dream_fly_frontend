/* Dream Fly — mobile 與 mobile-admin 兩 surface 共用的 overlay 堆疊 factory(單一來源)。
 * 原先兩份 stores.ts(mobile / mobile-admin)各有一份逐字相同的複本,自此單源於本檔;
 * 兩邊 stores 之後改以 re-export 供應既有 import 路徑(overlay 單例仍由各 surface 自建)。 */

import { writable } from 'svelte/store';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
// K6-4:push 與 sheet 是不相交的命名空間(push 進 stack、sheet 是獨立的單一浮層)，
// 泛型化為 PushId/SheetId 兩個獨立型別參數——單一泛型會讓兩邊互相汙染(如
// 'cart' 只合法屬於 sheet，若共用一個型別參數，push('cart') 會被誤放行)。
// OverlayEntry 本身也帶泛型(預設 `string`)，讓 stack/sheet 的 id 欄位跟著收窄，
// 否則 OverlayHost 的 `PUSH[top.id]` 在 strict 下仍無法索引 `Record<union, Comp>`
// (只泛型化 push()/sheet() 的參數簽名不夠)。
export interface OverlayEntry<Id extends string = string> {
	id: Id;
	props: Record<string, unknown>;
}
export interface OverlayState<PushId extends string = string, SheetId extends string = string> {
	stack: OverlayEntry<PushId>[];
	sheet: OverlayEntry<SheetId> | null;
}

/** push() / pop() drive the slide-in screen stack; sheet() / closeSheet() drive
 *  the single bottom sheet; closeAll() resets both (called on every tab change so
 *  an open overlay never survives navigation). 兩個型別參數皆預設為 `string`，
 *  裸 `createOverlay()`(既有測試建立獨立實例的既有寫法)行為不變。 */
export function createOverlay<PushId extends string = string, SheetId extends string = string>() {
	const { subscribe, update, set } = writable<OverlayState<PushId, SheetId>>({ stack: [], sheet: null });
	return {
		subscribe,
		push(id: PushId, props: Record<string, unknown> = {}) {
			update((o) => ({ ...o, stack: [...o.stack, { id, props }] }));
		},
		pop() {
			update((o) => ({ ...o, stack: o.stack.slice(0, -1) }));
		},
		sheet(id: SheetId, props: Record<string, unknown> = {}) {
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
