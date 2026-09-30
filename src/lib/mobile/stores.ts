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
 * CartSheet 的結帳流程本身已改真下單，`checkout` 單例（見下方）委派 `createCheckout`
 * (`$lib/member/checkout-sync`，內部再委派 `submitOrder`)，不再是本地假 checkout()。
 * 帳戶頁/點數頁/CartSheet 的即時點數餘額改直讀
 * `$lib/member/points` 的真 `points`/`pointsLedger`(Task 7 起不再經本檔轉手)。 */

import { createToasts } from '$lib/stores/toasts';
import { createOverlay } from '$lib/components/mobile/overlay';
import type { MobilePushRegistry, MobileSheetRegistry } from './overlay-registry';
import { refreshPoints } from '$lib/member/points';
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
// controller 檔頭與 CartSheet 該段註解。Task 9(架構深化 R15·F-5)：組裝本身
// （lines／placeOrder／applyCouponCode／points）收進 $lib/member/checkout-sync 的
// createCheckout，這裡只注入 mobile 自己的 cart 與兩份 refresh 清單。
import { createCheckout } from '$lib/member/checkout-sync';

/* ---------- Shopping cart (報名購物車) ---------- */
/** C2(架構深化 R9)：工廠本體上移為 lib-root 共用模組 $lib/cart（member 側也
 *  改吃同一份實作，dedup/qty 鎖/waitlist guard 語意單源）——這裡原本的行為孿生
 *  （twin）退役。factory 不在此收窄：mobile 只是拿一個無 persist 的實例（=
 *  現行為，不寫 localStorage），介面收斂為 subscribe/add/remove/clear 四個
 *  成員，不膨脹。add() 仍是薄 adapter——把 mobile 的 Course 轉成 factory 認得
 *  的 CartItemInput（經 courseToCartItem），並保留課程自帶 icon（來自 domain/course-category.ts
 *  的 courseCategoryIcon）覆寫掉 courseToCartItem 對公開課程消費端給的硬編
 *  預設('sparkles')——這段覆寫邏輯 factory 不擁有，留在這層做。 */
const cartBase = createCart(); // 無 persist(= mobile 現行為)
export const cart = { // 介面不膨脹:只出 4 個成員
	subscribe: cartBase.subscribe,
	add: (course: Course) => cartBase.addItem({ ...courseToCartItem(course), icon: course.icon }),
	remove: cartBase.remove,
	clear: cartBase.clear
};

// C3/R13：checkout 與 cart 同生命週期（模組級單例，比 CartSheet 這顆 mount 級元件
// 活得久）。Task 9(架構深化 R15·F-5)：desktop CheckoutDialog 與這裡各自組
// createCheckout({ cart, refreshAfterOrder, refreshOnOpen })——lines／placeOrder／
// applyCouponCode／points 的組裝單源自 $lib/member/checkout-sync，這裡只注入
// mobile 自己的 cart，以及「下單後」「開啟即水合」兩份 refresh 清單:都只有
// refreshPoints（mobile 購物車只產 course，恆空的 subscriptions 不必水合，見下方
// CartSheet.svelte 的既有註解）。mobile 不做付款方式選擇 UI(Round 4 P4-F4 裁決)，
// 呼叫端(CartSheet)一律沿用預設 credit_card——這由 checkout-controller 的表單預設
// 值負責，本檔不必再自己焊 placeOrder adapter。
export const checkout = createCheckout({
	cart,
	refreshAfterOrder: [refreshPoints],
	refreshOnOpen: [refreshPoints]
});

/* ---------- Toasts (above the tab bar, 2800ms — canonical store) ---------- */
export const toasts = createToasts(2800);
