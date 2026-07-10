/* Dream Fly — 行動版會員 App · cross-route client state.
 *
 * The prototype (app.jsx) kept tab / stack / sheet / cart / points / notifs /
 * toasts / prefs / profile in one React component. Rendered as real routes, the
 * bottom tabs are URLs but push-screens + sheets are overlay state, and the
 * cart / notifs / toasts / prefs / profile are shared stores that live here.
 * Toasts come from the canonical shared store (`createToasts` imported from
 * `$lib/stores/toasts`); no local factory is defined or exported here.
 *
 * Task 19：登入守門與 auth 狀態改用真實 `$lib/stores/authStore`(見
 * routes/mobile/+layout.svelte + guard.ts)——這個檔案不再有本地的 demo
 * `session` gate 旗標。`notifs`/`notifsHydrated` 由 `$lib/mobile/api.ts` 的
 * getNotifications() 水合真資料(同 member notifications 前例)。`cart` 仍是
 * 本地端購物車 —— 一個與 member 平行的 store，尚未合併(P2，見
 * task-19-report.md 的顧慮)；但 CartSheet 的結帳流程本身已改真下單，
 * `placeOrder()` 委派共用的 `submitOrder`(`$lib/checkout-order`，見下方該函式
 * 附註)，不再是本地假 checkout()。帳戶頁/點數頁/CartSheet 的即時點數餘額一律
 * 改讀 `$lib/member/stores` 的真 `points`/`pointsLedger`。 */

import { writable, derived, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import { createOverlay } from '$lib/components/mobile/overlay';
import { submitOrder, type OrderConfirmation, type PaymentMethod } from '$lib/checkout-order';
import { refreshPoints } from '$lib/member/stores';
import type { CartItem } from '$lib/member/data';
import { ME, NOTIFS_SEED, type NotifItem } from './data';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
// C5:factory 單源於 components/mobile/overlay.ts(與 mobile-admin 共用複本合併
// 而來);createOverlay 本身也重新 export(供既有測試建立獨立實例,見
// stores.test.ts 的 describe('createOverlay', …)),singleton 仍在此地建立。
export { createOverlay };
export type { OverlayEntry, OverlayState } from '$lib/components/mobile/overlay';
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

/* ---------- Checkout — 真訂單 API 接縫（Task 19 收尾：CartSheet 結帳接真）----
 * C4 收斂：原本焊在這裡的「同步購物車 → POST /orders → 下單後刷新 → 清購物車」
 * orchestration 已收斂進共用的 submitOrder(見 $lib/checkout-order)，placeOrder
 * 瘦成薄 adapter，只把行動版自己的東西經參數注入(見下方兩個函式)。 */
/** 行動版購物車行 → 伺服器 CartItem 的對映(submitOrder 的 lines 參數)。行動版
 *  購物車只有課程(沒有方案購買動線)，對映一律 type:'course'、qty 鎖 1；不需要
 *  桌面 chargeableLines 的「已持有 pass 跳過」過濾——那個過濾對 type:'course'
 *  恆是 no-op(只濾 type:'pass')。 */
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

/** 送出訂單：委派 submitOrder(同步購物車 → POST /orders(帶呼叫端提供的
 *  Idempotency-Key) → 下單後重新水合真點數餘額 → 清空(僅)行動版本地購物車)。
 *  回傳值為 OrderConfirmation(total 已是 NT$ 整數，呼叫端見 CartSheet)。任何
 *  失敗(400 購物車為空/優惠碼無效、409 滿班/已報名/點數不足等)原樣拋出、不清
 *  空購物車——呼叫端(CartSheet)catch 後用 member/checkout 的 orderErrorMessage()
 *  轉繁中 toast，同桌面 CheckoutDialog 的既有裁決。
 *  paymentMethod(Round 4 Task P4-F4):mobile 不做付款方式選擇 UI(計畫裁決)，
 *  呼叫端一律沿用預設 credit_card。 */
export async function placeOrder(
	coupon: string,
	usePoints: boolean,
	idempotencyKey: string = crypto.randomUUID(),
	paymentMethod: PaymentMethod = 'credit_card'
): Promise<OrderConfirmation> {
	return submitOrder(get(cart).map(toOrderItem), {
		coupon,
		usePoints,
		paymentMethod,
		idempotencyKey,
		afterOrder: () => [refreshPoints()],
		clearCart: () => cart.clear()
	});
}

/* ---------- Notification centre ---------- */
// C6:read-flag store 委派共用的 createReadState(見 $lib/stores/read-state,
// mobile 現形即標準極性,行為 1:1)。createNotifs 保留舊名(委派 alias),既有
// 呼叫端(本檔案 notifs 單例、stores.test.ts 既有測試)零變動。
export const createNotifs = createReadState;
export { unreadCount };
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
