/* Dream Fly — mobile 與 mobile-admin 兩 surface 共用的 overlay 堆疊 factory(單一來源)。
 * 原先兩份 stores.ts(mobile / mobile-admin)各有一份逐字相同的複本,自此單源於本檔;
 * overlay 單例仍由各 surface 的 stores.ts 自建(直接 import 本檔;R12 起兩邊 stores 不再
 * re-export createOverlay/OverlayEntry/OverlayState——零消費者的死出口,ADR-0010)。 */

import { writable } from 'svelte/store';
import type { Component, ComponentProps } from 'svelte';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
// K6-4:push 與 sheet 是不相交的命名空間(push 進 stack、sheet 是獨立的單一浮層)，
// 泛型化為兩個獨立型別參數——單一泛型會讓兩邊互相汙染(如
// 'cart' 只合法屬於 sheet，若共用一個型別參數，push('cart') 會被誤放行)。
// OverlayEntry 本身也帶泛型(預設 `string`)，讓 stack/sheet 的 id 欄位跟著收窄，
// 否則 OverlayHost 的 `push[top.id]` 在 strict 下仍無法索引 `Record<union, Component>`
// (只泛型化 push()/sheet() 的參數簽名不夠)。
// R12 Task 4:型別參數改為各 surface overlay-registry.ts 的註冊表(id → 元件),id 聯集
// 取其鍵、props 取元件 props 扣掉 host 注入的 onBack/onClose;儲存端 props 仍是寬鬆的
// Record<string, unknown>(host 只負責展開)。
export interface OverlayEntry<Id extends string = string> {
	id: Id;
	props: Record<string, unknown>;
}
export interface OverlayState<PushId extends string = string, SheetId extends string = string> {
	stack: OverlayEntry<PushId>[];
	sheet: OverlayEntry<SheetId> | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any>;
/** id → 元件的註冊表(各 surface 的 overlay-registry.ts 以 `satisfies` 宣告)。 */
export type OverlayRegistry = Record<string, AnyComponent>;
/** 呼叫端可傳的 props：元件 props 扣掉 host 一律注入的 onBack / onClose。 */
export type OverlayProps<C> = C extends AnyComponent ? Omit<ComponentProps<C>, 'onBack' | 'onClose'> : never;
/** props 全部可選時可省略整個引數;有必填 props 時必傳。 */
type PropsArg<P> = {} extends P ? [props?: P] : [props: P];
type DefaultRegistry = Record<string, Component<Record<string, unknown>>>;

/** push() / pop() drive the slide-in screen stack; sheet() / closeSheet() drive
 *  the single bottom sheet; closeAll() resets both (called on every tab change so
 *  an open overlay never survives navigation). 兩個型別參數皆預設為寬鬆註冊表，
 *  裸 `createOverlay()`(既有測試建立獨立實例的既有寫法)行為不變。 */
export function createOverlay<
	PushReg extends OverlayRegistry = DefaultRegistry,
	SheetReg extends OverlayRegistry = DefaultRegistry
>() {
	type PushId = keyof PushReg & string;
	type SheetId = keyof SheetReg & string;
	const { subscribe, update, set } = writable<OverlayState<PushId, SheetId>>({ stack: [], sheet: null });
	return {
		subscribe,
		push<K extends PushId>(id: K, ...args: PropsArg<OverlayProps<PushReg[K]>>) {
			const props = args[0] ?? {};
			update((o) => ({ ...o, stack: [...o.stack, { id, props }] }));
		},
		pop() {
			update((o) => ({ ...o, stack: o.stack.slice(0, -1) }));
		},
		sheet<K extends SheetId>(id: K, ...args: PropsArg<OverlayProps<SheetReg[K]>>) {
			const props = args[0] ?? {};
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
