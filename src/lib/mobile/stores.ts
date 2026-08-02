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
 * `session` gate 旗標。通知段(`notifs`/`unread`/已讀 mutation/session 閘門)C3
 * 起搬出成葉模組 `$lib/mobile/notifications.ts`(理由見下方該段註解)。`cart` 改吃
 * lib-root 共用工廠 $lib/cart(C2:與 member 側同一份實作，不再是平行 store；
 * 介面收斂為 subscribe/add/remove/clear 四個成員，詳見下方 Shopping cart 段落)；
 * CartSheet 的結帳流程本身已改真下單，
 * `placeOrder()` 委派共用的 `submitOrder`(`$lib/checkout-order`，見下方該函式
 * 附註)，不再是本地假 checkout()。帳戶頁/點數頁/CartSheet 的即時點數餘額一律
 * 改讀 `$lib/member/stores` 的真 `points`/`pointsLedger`。 */

import { writable, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createOverlay } from '$lib/components/mobile/overlay';
import { submitOrder, type OrderConfirmation, type PaymentMethod } from '$lib/checkout-order';
import { refreshPoints, subscriptions } from '$lib/member/stores';
import { chargeableLines } from '$lib/member/checkout';
import { createCart } from '$lib/cart';
import { courseToCartItem } from '$lib/cart-item';
import { ME, type Course } from './data';

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

/* ---------- 請假/補課表單機（卡 2：desktop/mobile 雙生收斂的 surface seam） ---------- */
// LeaveSheet/MakeupSheet 的表單機制（場次三態/守衛/trim）與桌面 LeaveDialog/
// MakeupDialog 共用同一份 $lib/member/leave-form 雙工廠——mobile 元件一律經這裡
// 取用（同 createOverlay 的 re-export 慣例）。deps（getCourseSessions/
// createLeaveRequest/bookMakeup）卡 3 起也經下方存量 re-export 塊取用，元件不再
// 直取 $lib/member/stores。
export { createLeaveRequestForm, createMakeupBookingForm } from '$lib/member/leave-form';

/* ---------- 取消請假（卡 6：desktop/mobile 雙生收斂的 surface seam） ---------- */
// MyCourseDetail 的取消請假機制（busy 守衛 + outcome 攜原始錯誤）與桌面 mine 頁
// 共用同一份 $lib/member/cancel-leave 工廠——mobile 元件一律經這裡取用（同上
// leave-form 的 re-export 慣例）。deps（cancelLeaveRequest）卡 3 起同樣經下方
// 存量 re-export 塊取用。
export { createCancelLeave } from '$lib/member/cancel-leave';

/* ---------- member 側 store/動作存量收編（卡 3） ---------- */
// mobile surface 的 production 元件一律經這裡取用 member 側的共用 store 與動作，
// 不再逐檔直取 $lib/member/*（foundation-contracts.test.ts 的 source-scan 契約
// 釘住：$lib/mobile/{api,stores,data,auth}.ts 四個 seam 檔之外零 $lib/member
// import）。源路徑必須精確 '$lib/member/stores'——sheet/overlay 測試 vi.mock 攔
// 的就是這個字串（佈線證明手段），寫錯路徑 mock 靜默失效＝假綠；同參照保證由
// stores.test.ts 的 identity pins 釘住。消費者：points/refreshPoints（CartSheet、
// PointsScreen、account 頁）、pointsLedger/redeemReward/redeemRewardErrorMessage
// （PointsScreen）、joinWaitlist/joinWaitlistErrorMessage（CourseDetailSheet、
// 首頁、courses 頁）、leave 家族（LeaveSheet/MakeupSheet/MyCourseDetail）。
export {
	points,
	pointsLedger,
	refreshPoints,
	redeemReward,
	redeemRewardErrorMessage,
	joinWaitlist,
	joinWaitlistErrorMessage,
	leaveRequests,
	refreshLeaveRequests,
	createLeaveRequest,
	cancelLeaveRequest,
	bookMakeup,
	leaveRequestErrorMessage,
	getCourseSessions
} from '$lib/member/stores';
export type { LeaveRequest, CourseSession } from '$lib/member/stores';
// 結帳輔助（CartSheet 的優惠碼驗證與錯誤文案映射）——同上，經 seam 收編。C6 起
// 再收編 chargeableLines:CartSheet 的可計費預覽（見該檔 $: chargeable）與 placeOrder
// 的請款（見下方）同吃這個唯一 brand 產地，型別強制「預覽 ≡ 請款」。
export { validateCoupon, orderErrorMessage, chargeableLines } from '$lib/member/checkout';
// C6:CartSheet 過濾可計費項目時，chargeableLines 的第二參數是「已持有訂閱」清單——
// subscriptions store 經 seam 收編（源 $lib/member/stores，foundation-contracts 白名單
// 既有）。mobile 購物車只產 course（cart.add 只收 Course；帳戶頁 getAccount() 副作用
// 仍可能水合 subscriptions，不可視為恆空），此過濾今日
// 恆 no-op;收進 seam 是為了讓型別強制的「預覽 ≡ 請款」在 mobile 也一體成立。
export { subscriptions } from '$lib/member/stores';

/* ---------- Shopping cart (報名購物車) ---------- */
/** C2(架構深化 R9)：工廠本體上移為 lib-root 共用模組 $lib/cart（member 側也
 *  改吃同一份實作，dedup/qty 鎖/waitlist guard 語意單源）——這裡原本的行為孿生
 *  （twin）退役。factory 不在此收窄：mobile 只是拿一個無 persist 的實例（=
 *  現行為，不寫 localStorage），介面收斂為 subscribe/add/remove/clear 四個
 *  成員，不膨脹。add() 仍是薄 adapter——把 mobile 的 Course 轉成 factory 認得
 *  的 CartItemInput（經 courseToCartItem），並保留課程自帶 icon（來自 api.ts
 *  的 CATEGORY_ICON 薄映射）覆寫掉 courseToCartItem 對公開課程消費端給的硬編
 *  預設('sparkles')——這段覆寫邏輯 factory 不擁有，留在這層做。 */
export type { AddResult } from '$lib/cart';
const cartBase = createCart(); // 無 persist(= mobile 現行為)
export const cart = { // 介面不膨脹:只出 4 個成員
	subscribe: cartBase.subscribe,
	add: (course: Course) => cartBase.addItem({ ...courseToCartItem(course), icon: course.icon }),
	remove: cartBase.remove,
	clear: cartBase.clear
};

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
 *  決定，改讓型別強制過濾:預覽(CartSheet 的 checkoutMath)與請款(此處 submitOrder)
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

/* ---------- Notification centre ---------- */
// C3(架構深化 R9):整段搬出成葉模組 $lib/mobile/notifications.ts——通知段改建
// createSessionGate 後需要 ./api 的 getNotifications,而 ./api 反過來 import 本檔的
// PREFS_DEFAULT,留在這裡即 stores ⇄ api 成環。**本檔刻意不 re-export 該模組**
// (re-export 會讓 api → stores → notifications → api 繞回成環),消費端直接
// import '$lib/mobile/notifications';與其他 member 側收編走 barrel 的慣例刻意不對稱。

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
