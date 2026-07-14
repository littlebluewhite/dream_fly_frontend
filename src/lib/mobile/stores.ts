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
import { api } from '$lib/api/client';
import { createToasts } from '$lib/stores/toasts';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import { createOverlay } from '$lib/components/mobile/overlay';
import { submitOrder, type OrderConfirmation, type PaymentMethod } from '$lib/checkout-order';
import { refreshPoints } from '$lib/member/stores';
import { courseToCartItem, type CartItem } from '$lib/cart-item';
import { ME, NOTIFS_SEED, type NotifItem, type Course } from './data';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
// C5:factory 單源於 components/mobile/overlay.ts(與 mobile-admin 共用複本合併
// 而來);createOverlay 本身也重新 export(供既有測試建立獨立實例,見
// stores.test.ts 的 describe('createOverlay', …)),singleton 仍在此地建立。
export { createOverlay };
export type { OverlayEntry, OverlayState } from '$lib/components/mobile/overlay';
// K6-4:push/sheet 各自的合法 id 集合,緊鄰 singleton 宣告——成員對齊現行
// OverlayHost.svelte 的 PUSH/SHEETS 註冊表鍵。overlay 泛型化後,呼叫端傳入不在
// 集合內的 id 會在編譯期被擋下(K6-3 前只有執行期的 foundation-contracts 掃描)。
export type MobilePushId = 'courseDetail' | 'schedule' | 'report' | 'points' | 'orders' | 'settings' | 'trial';
export type MobileSheetId = 'course' | 'cart' | 'leave' | 'makeup' | 'contact' | 'editProfile';
export const overlay = createOverlay<MobilePushId, MobileSheetId>();

/* ---------- Shopping cart (報名購物車) ---------- */
/** A full course (spots 0) never enters the paid cart — add() just reports
 *  'waitlisted'; the caller is expected to call joinWaitlist() itself (C8,
 *  Round 2 批次甲：mobile 候補改接 server seam，mirrors member/cart.ts's addItem —
 *  see routes/member/courses/+page.svelte). A repeat add of a course already in
 *  the cart is a no-op that reports 'bumped' — a course is an enrolment, not a
 *  quantity, so it never accumulates qty (mirrors member cart's addItem; see
 *  CONTEXT.md 報名). There is no updateQty(): with courses as the only line
 *  type, an increment/decrement control would have nothing legitimate to do
 *  (matches member cart's course qty lock — see its updateQty doc). */
export type AddResult = 'added' | 'bumped' | 'waitlisted';
/** K5:自持的 CartInput/CartLine 一次性型別已退役，購物車行收斂為全站共用的
 *  `CartItem`（見 $lib/cart-item）——欄位對映單源於 courseToCartItem，這裡只做
 *  一件事：spread 後覆寫 icon，保留課程自帶 icon（來自 api.ts 的 CATEGORY_ICON
 *  薄映射）蓋過 courseToCartItem 對 CatalogCourse 消費端的硬編預設
 *  （'sparkles'）。去重鍵同步升級為 (type, id) 複合鍵，鏡射 member cart 的
 *  addItem 慣例；mobile 目前仍只有 course 一種來源，不開放 addItem（interface
 *  不膨脹）。 */
export function createCart() {
	const { subscribe, update, set } = writable<CartItem[]>([]);
	return {
		subscribe,
		add(course: Course): AddResult {
			if (course.spots === 0) {
				return 'waitlisted';
			}
			const item: CartItem = { ...courseToCartItem(course), icon: course.icon };
			let result: AddResult = 'added';
			update((items) => {
				const ex = items.find((c) => c.type === item.type && c.id === item.id);
				if (ex) {
					result = 'bumped';
					return items; // qty 鎖 1 —— 課程是報名不是數量
				}
				return [...items, item];
			});
			return result;
		},
		remove(id: string) {
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
/** 送出訂單：委派 submitOrder(同步購物車 → POST /orders(帶呼叫端提供的
 *  Idempotency-Key) → 下單後重新水合真點數餘額 → 清空(僅)行動版本地購物車)。
 *  回傳值為 OrderConfirmation(total 已是 NT$ 整數，呼叫端見 CartSheet)。任何
 *  失敗(400 購物車為空/優惠碼無效、409 滿班/已報名/點數不足等)原樣拋出、不清
 *  空購物車——呼叫端(CartSheet)catch 後用 member/checkout 的 orderErrorMessage()
 *  轉繁中 toast，同桌面 CheckoutDialog 的既有裁決。
 *  paymentMethod(Round 4 Task P4-F4):mobile 不做付款方式選擇 UI(計畫裁決)，
 *  呼叫端一律沿用預設 credit_card。
 *  K5-b:購物車本身已是 CartItem[](見上 cart 段)，直接把 get(cart) 傳給
 *  submitOrder——mobile 只有課程來源(沒有方案購買動線)，不需要桌面
 *  chargeableLines 的「已持有 pass 跳過」過濾(那個過濾對 type:'course' 恆是
 *  no-op)，原本焊在這裡的 toOrderItem 投影 adapter 已整顆刪除。 */
export async function placeOrder(
	coupon: string,
	usePoints: boolean,
	idempotencyKey: string = crypto.randomUUID(),
	paymentMethod: PaymentMethod = 'credit_card'
): Promise<OrderConfirmation> {
	return submitOrder(get(cart), {
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
const notifsBase = createNotifs<NotifItem>(NOTIFS_SEED);
export const notifsHydrated = writable(false);
/** K2-c 協定補完:markRead/markAllRead 原本完全沒有翻旗協定,mutation 後
 *  notifsHydrated 仍是 false,重訪通知頁會被 load-gate 判定「尚未水合」而整包
 *  重抓、覆寫掉這裡的已讀 mutation。包裝函式在呼叫共用邏輯後翻
 *  notifsHydrated.set(true),對齊 member 的 markMutated 協定(見
 *  $lib/member/notifications.ts)。set() 不繞這層——水合本身由通知頁的
 *  load-gate hydrate 選項在 into() 之後自己翻旗,不需要這裡重覆翻。
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
		notifsHydrated.set(true); // 翻旗(≡ markMutated)
		try {
			await api(`/notifications/${id}/read`, { method: 'PATCH' });
		} catch (err) {
			console.error('Failed to mark notification as read:', err); // 不還原(member 不閃爍原則)
		}
	},
	async markAllRead(): Promise<'ok' | 'partial'> {
		const unreadIds = get(notifsBase).filter((n) => !n.read).map((n) => n.id); // 必須在 markAllRead() 前捕捉
		notifsBase.markAllRead();
		notifsHydrated.set(true);
		const results = await Promise.allSettled(
			unreadIds.map((id) => api(`/notifications/${id}/read`, { method: 'PATCH' }))
		);
		const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
		failures.forEach((f) => console.error('Failed to mark notification as read:', f.reason));
		return failures.length > 0 ? 'partial' : 'ok';
	}
};
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
/** W3:PREFS_DEFAULT 原本在這裡與 api.ts(getPreferences 後端未設定值時的
 *  fallback)各自硬編一份同字面常數,兩處要同步改。單源改宣告在這裡,api.ts
 *  改 import 使用。顯式型別註記 `: Prefs`(非整段 `as Prefs` 斷言)——ADR 0012
 *  §3 合規。 */
export const PREFS_DEFAULT: Prefs = { classReminder: true, coachMsg: true, promo: false, dark: false };
export const prefs = writable<Prefs>({ ...PREFS_DEFAULT }); // spread 防常數被 store 突變污染

export const profile = writable({
	...ME,
	birth: '2013/05/18',
	phone: '0912-345-678',
	email: 'wang.family@example.com',
	guardian: '王先生 · 0911-222-333'
});
