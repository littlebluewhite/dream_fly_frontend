/* Dream Fly — 行動版會員 App · cross-route client state.
 *
 * The prototype (app.jsx) kept tab / stack / sheet / cart / points / notifs /
 * toasts / prefs / profile in one React component. Rendered as real routes, the
 * bottom tabs are URLs but push-screens + sheets are overlay state, and the
 * cart / toasts are shared stores that live here — points / notifications /
 * prefs / profile / leave / waitlist 等關切一律屬於 member 側，本檔不再轉手
 * (Task 7·架構深化 R15·F-4：重開 ADR-0024 F6／ADR-0014 §1——mobile production
 * 消費端改直取 `$lib/member/<concern>`，這裡只留 mobile 真正自有的狀態)。
 * Toasts come from the canonical shared store (`createToasts` imported from
 * `$lib/stores/toasts`); no local factory is defined or exported here.
 *
 * Task 19：登入守門與 auth 狀態改用真實 `$lib/stores/authStore`(見
 * routes/mobile/+layout.svelte + guard.ts)——這個檔案不再有本地的 demo
 * `session` gate 旗標。`cart` 改吃
 * lib-root 共用工廠 $lib/cart(C2:與 member 側同一份實作，不再是平行 store；
 * 介面收斂為 subscribe/add/remove/clear 四個成員，詳見下方 Shopping cart 段落)；
 * CartSheet 的結帳流程本身已改真下單，
 * `placeOrder()` 委派共用的 `submitOrder`(`$lib/checkout-order`，見下方該函式
 * 附註)，不再是本地假 checkout()。帳戶頁/點數頁/CartSheet 的即時點數餘額改直讀
 * `$lib/member/points` 的真 `points`/`pointsLedger`(Task 7 起不再經本檔轉手)。 */

import { derived, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createOverlay } from '$lib/components/mobile/overlay';
import type { MobilePushRegistry, MobileSheetRegistry } from './overlay-registry';
import { submitOrder, type OrderConfirmation, type PaymentMethod } from '$lib/checkout-order';
import { points, refreshPoints } from '$lib/member/points';
import { subscriptions } from '$lib/member/subscriptions';
import { applyCouponCode, chargeableLines } from '$lib/member/checkout';
import { createCart } from '$lib/cart';
import { courseToCartItem } from '$lib/cart-item';
import { type Course } from './data';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
// C5:factory 單源於 components/mobile/overlay.ts(與 mobile-admin 共用複本合併
// 而來);createOverlay 的直接單元測試在 overlay.test.ts(Task 1(1.5)：本檔過去
// 純轉出 createOverlay/OverlayEntry/OverlayState 供 stores.test.ts 建獨立實例，
// 零其餘消費者，已退役——ADR-0010「死值不留死出口」),singleton 仍在此地建立。
// K6-4:push/sheet 各自的合法 id 集合由 overlay-registry.ts 的註冊表鍵推出;各 id 的
// props 由註冊元件的 props 推出,呼叫端傳錯 id / 錯 props / 漏必填 props 都在編譯期擋下。
// 註冊表只能以敘述層級 `import type` 引入(verbatimModuleSyntax 下編譯後整行抹除),
// 否則執行期會把全部 overlay 元件拉進本檔載入鏈。
export type MobilePushId = keyof MobilePushRegistry;
export type MobileSheetId = keyof MobileSheetRegistry;
export const overlay = createOverlay<MobilePushRegistry, MobileSheetRegistry>();

/* ---------- 結帳付款狀態機（C2/R11 起、C3/R13 升級：desktop/mobile 雙生收斂的 surface
 * seam） ---------- */
// CartSheet 的付款生命週期（step/paying/paid、idempotencyKey、防重複扣款守衛）與桌面
// CheckoutDialog 共用同一份 $lib/member/checkout-controller 工廠。C3/R13 起不再逐次
// re-export 工廠讓 CartSheet 自己 new——工廠轉出失去唯一消費者，退役；改在這裡建一顆
// 模組級單例 `checkout`（與下方 `cart` 同生命週期，比 CartSheet 這顆 mount 級元件活得
// 久），CartSheet 隨 sheet 開關呼叫 setOpen(true/false)，語意同桌面 $checkoutOpen 的
// 閉→開偵測——sheet 若在付款飛行中被外力關閉（如導航觸發的 closeAll）又重開，走
// resumedInFlight，同一把 key 續用、paying 繼續鎖住，不會開出第二張真訂單。詳見
// controller 檔頭與 CartSheet 該段註解。
import { createCheckoutController } from '$lib/member/checkout-controller';

/* ---------- Shopping cart (報名購物車) ---------- */
/** C2(架構深化 R9)：工廠本體上移為 lib-root 共用模組 $lib/cart（member 側也
 *  改吃同一份實作，dedup/qty 鎖/waitlist guard 語意單源）——這裡原本的行為孿生
 *  （twin）退役。factory 不在此收窄：mobile 只是拿一個無 persist 的實例（=
 *  現行為，不寫 localStorage），介面收斂為 subscribe/add/remove/clear 四個
 *  成員，不膨脹。add() 仍是薄 adapter——把 mobile 的 Course 轉成 factory 認得
 *  的 CartItemInput（經 courseToCartItem），並保留課程自帶 icon（來自 api.ts
 *  的 CATEGORY_ICON 薄映射）覆寫掉 courseToCartItem 對公開課程消費端給的硬編
 *  預設('sparkles')——這段覆寫邏輯 factory 不擁有，留在這層做。 */
const cartBase = createCart(); // 無 persist(= mobile 現行為)
export const cart = { // 介面不膨脹:只出 4 個成員
	subscribe: cartBase.subscribe,
	add: (course: Course) => cartBase.addItem({ ...courseToCartItem(course), icon: course.icon }),
	remove: cartBase.remove,
	clear: cartBase.clear
};

// C3/R13：checkout 與 cart 同生命週期（模組級單例，比 CartSheet 這顆 mount 級元件
// 活得久）——placeOrder 即下方緊接著的 placeOrder（函式宣告已提升，這裡引用它先於
// 其文字定義出現不影響執行期）。Task 5(R14·F4)：結算輸入與預覽也住進單例，deps 補齊
// applyCouponCode 與兩個唯讀來源——lines 與 placeOrder 的請款同吃 chargeableLines
// （預覽 ≡ 請款），points 是 member 側的真餘額。詳見上方段落註解與 checkout-controller
// 檔頭。
export const checkout = createCheckoutController({
	placeOrder,
	applyCouponCode,
	lines: derived([cart, subscriptions], ([c, s]) => chargeableLines(c, s)),
	points
});

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
 *  C6(反轉 K5-b):submitOrder 的 lines 收窄為 ChargeableLine[](可計費約束 brand，
 *  見 $lib/cart-item)，唯一產地是 chargeableLines()。K5-b 曾裁定 mobile「不需要
 *  過濾、直傳 get(cart)」——理由是 course-only 購物車的過濾恆 no-op;C6 反轉這個
 *  決定，改讓型別強制過濾:預覽(checkout 單例的 preview)與請款(此處 submitOrder)
 *  兩個終點同吃 chargeableLines 的輸出，「預覽合計 ≡ 實際請款」不再靠呼叫端記憶、
 *  而是編譯期保證。對今日 course-only 購物車行為零變動(空訂閱、course 恆保留)，
 *  未來若方案購買動線上架，過濾已就位、自動安全。 */
export async function placeOrder(
	coupon: string,
	usePoints: boolean,
	idempotencyKey: string = crypto.randomUUID(),
	paymentMethod: PaymentMethod = 'credit_card'
): Promise<OrderConfirmation> {
	return submitOrder(chargeableLines(get(cart), get(subscriptions)), {
		coupon,
		usePoints,
		paymentMethod,
		idempotencyKey,
		afterOrder: () => [refreshPoints()],
		clearCart: () => cart.clear()
	});
}

/* ---------- Toasts (above the tab bar, 2800ms — canonical store) ---------- */
export const toasts = createToasts(2800);
