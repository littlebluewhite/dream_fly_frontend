/* Dream Fly — 會員中心 · cross-route client state — barrel。
 *
 * The prototype kept cart / points / notifications / toasts in the top-level
 * React component. Because we render the member centre as real SvelteKit routes,
 * that shared state lives in module stores instead. Since Tasks 16-17 the
 * checkout / subscriptions / points / notifications state is backed by the real
 * API (hydrated via each module's refresh* functions); only the cart itself stays
 * a local store, synced to the server at checkout time (syncCartToServer).
 *
 * 這支檔案本身是「關切模組的 barrel」——不放任何實作，只逐名再匯出下列 8 個
 * 關切模組的 public exports（型別一律用 `export type`）。新增 store／函式請寫進
 * 歸屬模組，不要寫進這裡：
 *  - cart.ts            購物車 store + 持久化
 *  - waitlist.ts        候補清單
 *  - leave.ts           請假 + 補課 + 課程場次
 *  - points.ts          點數 + 明細 + 兌換
 *  - subscriptions.ts   訂閱 / entitlement
 *  - checkout-sync.ts   購物車同步 + 送出訂單
 *  - notifications.ts   通知中心
 *  - ui.ts              跨路由 UI 狀態（checkoutOpen/search/toasts） */

export { createCart, cart, cartCount } from './cart';
export type { AddResult } from './cart';

export { waitlist, refreshWaitlist, joinWaitlist, cancelWaitlist, joinWaitlistErrorMessage } from './waitlist';
export type { WaitlistEntry } from './waitlist';

export {
  leaveRequests,
  refreshLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  bookMakeup,
  leaveRequestErrorMessage,
  getCourseSessions
} from './leave';
export type { LeaveRequest, CourseSession } from './leave';

export { points, pointsLedger, refreshPoints, redeemReward, redeemRewardErrorMessage } from './points';
export type { ApiLedgerEntry, ApiPointsMe, ApiRedeemResult } from './points';

export { subscriptions, refreshSubscriptions } from './subscriptions';
export type { ApiSubscription } from './subscriptions';

export { placeOrder } from './checkout-sync';
export type { PaymentMethod } from '$lib/checkout-order';

export { notifications, unreadCount, notificationsHydrated, refreshNotifications } from './notifications';

export { checkoutOpen, search, toasts } from './ui';
