/* Dream Fly — 行動版會員 App · cross-route client state.
 *
 * The prototype (app.jsx) kept tab / stack / sheet / cart / points / notifs /
 * toasts / prefs / profile in one React component. Rendered as real routes, the
 * bottom tabs are URLs but push-screens + sheets are overlay state, and the
 * cart / points / notifs / toasts / prefs / profile are shared stores that live
 * here. Toasts come from the canonical shared store (`createToasts` imported
 * from `$lib/stores/toasts`); no local factory is defined or exported here.
 *
 * Task 19：登入守門與 auth 狀態改用真實 `$lib/stores/authStore`(見
 * routes/mobile/+layout.svelte + guard.ts)——這個檔案不再有本地的 demo
 * `session` gate 旗標。`notifs`/`notifsHydrated` 由 `$lib/mobile/api.ts` 的
 * getNotifications() 水合真資料(同 member notifications 前例)。`cart` 仍是
 * 本地端購物車 —— 一個與 member 平行的 store，尚未合併(P2，見
 * task-19-report.md 的顧慮)；但 CartSheet 的結帳流程本身已改真下單，復用
 * member 的 syncCartToServer/api()/refreshPoints(見下方 placeOrder())，不再
 * 是本地假 checkout()。帳戶頁/點數頁/CartSheet 的即時點數餘額一律改讀
 * `$lib/member/stores` 的真 `points`/`pointsLedger`。這裡的本地 `points` 已無
 * 任何呼叫端(其唯一呼叫端 redeemReward() 隨 Round 3 接線清理一併移除)。 */

import { writable, derived, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { api } from '$lib/api/client';
import { syncCartToServer, refreshPoints, type ApiOrder } from '$lib/member/stores';
import type { CartItem } from '$lib/member/data';
import { ME, NOTIFS_SEED, type NotifItem } from './data';

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
export const overlay = createOverlay();

/* ---------- Shopping cart (報名購物車) ---------- */
/** A catalog course as added to the cart — core fields are typed; the index
 *  signature carries the rest of the course verbatim (icon / level / desc …)
 *  for the cart sheet. Kept as its own interface (not `Omit<CartLine>`) because
 *  an index signature collapses `keyof`, which would break Omit. */
export interface CartInput {
	id: string | number;
	name: string;
	price: number;
	spots: number;
	[k: string]: unknown;
}
export interface CartLine extends CartInput {
	qty: number;
}
/** add() records a full course (spots 0) on the waitlist instead of adding it to
 *  the paid cart. A repeat add of a course already in the cart is a no-op that
 *  reports 'bumped' — a course is an enrolment, not a quantity, so it never
 *  accumulates qty (mirrors member cart's addItem; see CONTEXT.md 報名). There
 *  is no updateQty(): with courses as the only line type, an increment/decrement
 *  control would have nothing legitimate to do (matches member cart's course
 *  qty lock — see its updateQty doc). */
export type AddResult = 'added' | 'bumped' | 'waitlisted';
export function createCart() {
	const { subscribe, update, set } = writable<CartLine[]>([]);
	// 候補登記:額滿(spots 0)課程不進付費購物車,改記在此(去重、冪等)。
	const waitlist = writable<(string | number)[]>([]);
	return {
		subscribe,
		waitlist,
		add(course: CartInput): AddResult {
			if (course.spots === 0) {
				waitlist.update((ids) => (ids.includes(course.id) ? ids : [...ids, course.id]));
				return 'waitlisted';
			}
			let result: AddResult = 'added';
			update((items) => {
				const ex = items.find((c) => c.id === course.id);
				if (ex) {
					result = 'bumped';
					return items; // qty 鎖 1 —— 課程是報名不是數量
				}
				const line: CartLine = { ...course, qty: 1 };
				return [...items, line];
			});
			return result;
		},
		remove(id: string | number) {
			update((items) => items.filter((c) => c.id !== id));
		},
		clear() {
			set([]);
		}
	};
}
export const cart = createCart();

/** Total item count across cart lines. */
export function cartCount(items: { qty: number }[]): number {
	return items.reduce((s, c) => s + c.qty, 0);
}
export const cartTotal = derived(cart, ($c) => cartCount($c));

/* ---------- Member points (點數) ----------
 * 本地殘值已無任何呼叫端——帳戶頁/點數頁/CartSheet 的即時餘額一律讀
 * `$lib/member/stores` 的真 points。 */
export const points = writable(ME.points);

/* ---------- Checkout — 真訂單 API 接縫（Task 19 收尾：CartSheet 結帳接真）----
 * 取代原本的本地假 checkout()：復用桌面 member 的結帳網路層（syncCartToServer /
 * api() / refreshPoints，見 $lib/member/stores.ts），不重新實作一次 HTTP。不能
 * 直接呼叫桌面的 placeOrder()——它內部讀桌面自己的 cart store(get(cart))，跟
 * 這裡的行動版本地購物車是兩個平行的 store(P2，尚未合併，見本檔案開頭註解)。
 * 改成顯式把「行動版購物車行 → 伺服器 CartItem」對映後傳入，其餘（同步、送
 * 單、Idempotency-Key、下單後水合真點數、清空購物車）與桌面 placeOrder 同一套
 * 邏輯，只是 clear() 的對象是這個檔案自己的 cart——桌面 cart store 完全不受影
 * 響。行動版購物車只有課程(沒有方案購買動線)，對映一律 type:'course'、qty 鎖
 * 1；不需要桌面 chargeableLines 的「已持有 pass 跳過」過濾——那個過濾對
 * type:'course' 恆是 no-op(只濾 type:'pass')。 */
function toOrderItem(line: CartLine): CartItem {
	return {
		id: String(line.id),
		type: 'course',
		name: line.name,
		price: line.price,
		qty: 1,
		icon: typeof line.icon === 'string' ? line.icon : 'graduation-cap'
	};
}

/** 送出訂單：同步(對映後的)購物車到伺服器 → POST /orders(帶呼叫端提供的
 *  Idempotency-Key) → 下單後重新水合真點數餘額 → 清空(僅)行動版本地購物車。
 *  任何失敗(400 購物車為空/優惠碼無效、409 滿班/已報名/點數不足等)原樣拋出、
 *  不清空購物車——呼叫端(CartSheet)catch 後用 member/checkout 的
 *  orderErrorMessage() 轉繁中 toast，同桌面 CheckoutDialog 的既有裁決。 */
export async function placeOrder(
	coupon: string,
	usePoints: boolean,
	idempotencyKey: string = crypto.randomUUID()
): Promise<ApiOrder> {
	await syncCartToServer(get(cart).map(toOrderItem));
	const order = await api<ApiOrder>('/orders', {
		method: 'POST',
		body: JSON.stringify({ coupon_code: coupon || undefined, use_points: usePoints }),
		headers: { 'Idempotency-Key': idempotencyKey }
	});
	await refreshPoints().catch((err) => console.error('Failed to refresh points after checkout:', err));
	cart.clear();
	return order;
}

/* ---------- Notification centre ---------- */
/** read-flag store; markRead flips one, markAllRead clears all. Immutable update
 *  so the seed array is never mutated. `set` is exposed for hydration (the
 *  notifications 頁 writes getNotifications() 的結果進來),不影響既有 mutation。 */
export function createNotifs<T extends { id: string; read: boolean }>(seed: T[]) {
	const { subscribe, update, set } = writable<T[]>(seed.map((n) => ({ ...n })));
	return {
		subscribe,
		set,
		markRead(id: string) {
			update((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
		},
		markAllRead() {
			update((ns) => ns.map((n) => ({ ...n, read: true })));
		}
	};
}
export function unreadCount(items: { read: boolean }[]): number {
	return items.filter((n) => !n.read).length;
}
// 同步 seed(createNotifs 內部 clone;與 member notifications 前例同型):badge
// (unread,TabBar/首頁鈴鐺都讀)一開始就有值。首次造訪通知頁時經 getNotifications()
// 接縫水合覆寫一次(見該頁 load()/refresh());notifsHydrated 是 load-once 守衛,
// 防止重訪重抓覆寫已讀狀態。
export const notifs = createNotifs<NotifItem>(NOTIFS_SEED);
export const notifsHydrated = writable(false);
export const unread = derived(notifs, ($n) => unreadCount($n));

/* ---------- Toasts (above the tab bar, 2800ms — canonical store) ---------- */
export const toasts = createToasts(2800);

/* ---------- Preferences + profile (帳戶 / 設定) ---------- */
export interface Prefs {
	classReminder: boolean;
	coachMsg: boolean;
	promo: boolean;
	dark: boolean;
}
export const prefs = writable<Prefs>({ classReminder: true, coachMsg: true, promo: false, dark: false });

export const profile = writable({
	...ME,
	birth: '2013/05/18',
	phone: '0912-345-678',
	email: 'wang.family@example.com',
	guardian: '王先生 · 0911-222-333'
});
