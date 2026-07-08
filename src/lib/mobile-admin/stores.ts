/* Dream Fly — 行動版後台 · cross-route client state.
 *
 * The prototype (app.jsx) kept role / tab / stack / sheet / toasts / live
 * members·classes·coaches / notifs in one React component. Rendered as real
 * routes, role + tab are URLs but push-screens + sheets are overlay state; the
 * live collections, notifs and toasts are shared stores here. Factories are
 * exported for isolated test instances; the app uses the singletons.
 *
 * Task 20：members/classes/coaches/orders/messages 現由 $lib/mobile-admin/api
 * 的 getOpsCollections()/getMessages() 供給真資料(該檔再往下委派桌面 admin/coach
 * seams)——這裡的 store 本身不知道資料來源，只負責水合守衛/樂觀更新等跨路由狀態
 * 管理，見各函式附註。notifs(通知中心鈴鐺)仍為 mock，無對應後端來源。 */

import { writable, derived } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createHydrationGate } from '$lib/hydration-gate';
import { createOverlay } from '$lib/components/mobile/overlay';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import type { Role } from './nav';
import { MEMBERS, CLASSES, COACHES, ORDERS, MESSAGES, ADMIN_NOTIFS, COACH_NOTIFS, type MemberRow, type ClassRow, type Coach, type OrderRow, type MessageRow, type AdminNotif } from './data';
import { getOpsCollections, getMessages, markRead } from './api';

/* ---------- Overlay (push-screen stack + one bottom sheet) ----------
 * 單源於 `$lib/components/mobile/overlay`(mobile 與 mobile-admin 兩 surface 共用
 * 同一份 factory,見該檔頂端註解)——overlay 單例仍由本 surface 自建(per-surface
 * 狀態)。 */
export { createOverlay };
export type { OverlayEntry, OverlayState } from '$lib/components/mobile/overlay';
export const overlay = createOverlay();

/* ---------- Notifications (mobile bell — `read` flag) ----------
 * 單源於 `$lib/stores/read-state` 的 createReadState(Admin / coach 通知鈴鐺全部
 * 標為已讀共用同一個 factory,見該檔頂端註解——不可變更新,保留 seed 陣列不被
 * 動到)。adminUnread 保留舊名(呼叫端零變動),內部直接委派 unreadCount。 */
export const adminUnread = unreadCount;
export const adminNotifs = createReadState<AdminNotif>(ADMIN_NOTIFS);
export const coachNotifs = createReadState<AdminNotif>(COACH_NOTIFS);

/* ---------- Live collections (新增 / 編輯 表單寫回) ---------- */
/** Replace a record by id, or prepend it when the id is new (app.jsx save*). */
export function upsertById<T extends { id: string | number }>(list: T[], rec: T): T[] {
	return list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [rec, ...list];
}
/** Next sequential id: `${prefix}${count + 1}`, optionally zero-padded to `pad`. */
export function nextId(prefix: string, list: unknown[], pad = 0): string {
	const n = String(list.length + 1);
	return prefix + (pad ? n.padStart(pad, '0') : n);
}

export const members = writable<MemberRow[]>(MEMBERS);
export const classes = writable<ClassRow[]>(CLASSES);
export const coaches = writable<Coach[]>(COACHES);

/** Create (id assigned) or update a coach record in place. Also flips
 *  `opsHydrated` true: a mutation IS the session's source of truth, so it must
 *  not be silently wiped by a first-time hydrate that races it (見下方
 *  opsHydrated 守衛註解 — C1 regression fix)。(saveMember/saveClass 的本地寫入版本
 *  已隨 Task 20 新增/編輯改接真 POST/PATCH /courses·/users 移除——真寫入成功後改
 *  呼叫 refreshOps() 整包重抓，不再局部樂觀更新這兩個 store；saveCoach 尚無對應
 *  的真後端寫入端點，繼續保留本地版本。) */
export function saveCoach(rec: Coach, isNew: boolean) {
	coaches.update((cs) => (isNew ? [{ ...rec, id: nextId('c', cs) }, ...cs] : upsertById(cs, rec)));
	opsGate.markMutated();
}

/** Live orders, so 標記已付款 actually persists. The orders screen KPIs (本月已收
 *  revenue, 待付款 count) and the admin home 待付款 banner all derive from this
 *  store — keep it the single source of truth for order status. */
export const orders = writable<OrderRow[]>(ORDERS);
/** Flip a pending order to paid and stamp the receipt time, so revenue / counts /
 *  filter chips recompute. Without this the action only toasts and the row stays
 *  pending. The detail sheet closes on action, so only the list needs to react.
 *  Also flips `opsHydrated` true(同 saveCoach — mutation 即宣告水合真相)。 */
export function markOrderPaid(id: string) {
	orders.update((os) => os.map((o) => (o.id === id ? { ...o, status: 'paid', paidAt: '剛剛' } : o)));
	opsGate.markMutated();
}

/** 集合水合守衛(members/classes/coaches/orders 一次到位)。四個 store 都保留同步
 *  seed(對齊 mobile notifs 前例;空起始會造成跨頁讀值的行為回歸)。hydrateOps()
 *  由 classes/members/orders 任一消費頁在 onMount 觸發;save* / markOrderPaid 等
 *  mutation 呼叫 opsGate.markMutated()(mutation 即宣告水合真相),防止「水合前的
 *  新增/編輯」被首次水合的 seed clone 無聲清除(C1 regression:admin 首頁快速操作
 *  新增學員/教練 → 首次進 classes/members/orders 任一頁 → 舊碼會用 seed 覆寫剛
 *  新增的資料)。refreshOps() 保持無條件寫入,供「重新整理」/ErrorState 重試共用
 *  (使用者明確要求最新資料,不受 guard 短路保護)。guard 短路 + post-await
 *  re-check(mutation 勝出)的機制本身由 `createHydrationGate` 提供,見
 *  `$lib/hydration-gate` 的模組註解。fetch 包一層箭頭函式(不直接傳函式參照)——
 *  維持原本「只有實際呼叫 hydrateOps()/refreshOps() 時才讀取 getOpsCollections
 *  這個 binding」的惰性時機,而非在本模組載入當下就讀取;純 import stores.ts 而
 *  不曾呼叫 hydrateOps() 的頁面測試,其 api mock 因此不必連帶提供 getOpsCollections。 */
const opsGate = createHydrationGate({
	fetch: () => getOpsCollections(),
	apply: (d) => {
		members.set(d.members);
		classes.set(d.classes);
		coaches.set(d.coaches);
		orders.set(d.orders);
	}
});
export const opsHydrated = opsGate.hydrated;
export const hydrateOps = opsGate.hydrate;
export const refreshOps = opsGate.refresh;

/** Live parent-message threads. The coach 訊息 badge + row highlight derive from
 *  this store, so reading a thread updates both — the static seed only ever showed
 *  the original unread count for the whole session. */
export const messages = writable<MessageRow[]>(MESSAGES.map((m) => ({ ...m })));
/** Mark a thread read (the coach opened it). Also flips `messagesHydrated` true
 *  (同 ops 集合的 save* / markOrderPaid — mutation 即宣告水合真相,防止首次水合
 *  覆寫)。Task 20：本地立即翻已讀(樂觀更新，同既有 UX)之餘，一併 best-effort 打真
 *  PATCH /conversations/{id}/read(markRead，coach/api.ts)——已讀回條屬於「最終
 *  一致即可」的次要狀態，失敗不影響本地已讀顯示，也不阻塞使用者操作，故 fire-
 *  and-forget、不 await、吞掉錯誤(id 即 getMessages() 映射出的 conversation id)。 */
export function markMessageRead(id: string) {
	messages.update((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m)));
	messagesGate.markMutated();
	void markRead(id).catch(() => {});
}
export const coachMsgUnread = derived(messages, ($m) => $m.filter((x) => x.unread).length);

/** 訊息水合守衛 — 與 orders/classes/members/coaches 的 ops 集合屬不同領域(coach
 *  訊息串列 vs 管理端營運集合),故獨立一套守衛,不併入 opsGate。同步 seed 保留
 *  (對齊 mobile notifs 前例);markMessageRead 呼叫 messagesGate.markMutated()
 *  (mutation 即宣告水合真相)。refreshMessages() 保持無條件寫入,供重試使用。
 *  guard 短路 + post-await re-check(mutation 勝出)的機制本身由
 *  `createHydrationGate` 提供,見 `$lib/hydration-gate` 的模組註解。fetch 包一層
 *  箭頭函式,理由同 opsGate——維持惰性讀取 getMessages 這個 binding 的時機。 */
const messagesGate = createHydrationGate({
	fetch: () => getMessages(),
	apply: (d) => {
		messages.set(d);
	}
});
export const messagesHydrated = messagesGate.hydrated;
export const hydrateMessages = messagesGate.hydrate;
export const refreshMessages = messagesGate.refresh;

/* ---------- Role (current section, synced from the URL by +layout.svelte) ----------
 * Task 20: the demo `session` writable is gone (real login state lives in
 * authStore; nothing ever read `$session` reactively — it was write-only, so
 * removing it is a straight orphan cleanup, not a behaviour change). `role` is
 * no longer the security-relevant bit either (the layout guard checks the
 * real authStore roles against the URL's role segment) — it survives purely
 * as the "which section am I looking at" display value the 更多/設定頁 profile
 * chip and RoleSheet read. */
export const role = writable<Role>('admin');

/* ---------- Toasts (above the tab bar, 2800ms — canonical store) ---------- */
export const toasts = createToasts(2800);

/* ---------- Convenience derived counts ---------- */
export const adminUnreadCount = derived(adminNotifs, ($n) => adminUnread($n));
export const coachUnreadCount = derived(coachNotifs, ($n) => adminUnread($n));

/** Switch the displayed role. Task 20: no longer persists to localStorage
 *  (`df_madmin_role` was one of the two demo flags removed with real auth) —
 *  the caller always follows this with `goto(adminPath(r, …))`, and the real
 *  destination on a fresh visit to the bare `/mobile-admin` root is decided by
 *  `mobileAdminRootTarget()` from the account's actual staff roles, not a
 *  remembered preference. */
export function switchRole(r: Role) {
	role.set(r);
}

/** Mark every bell notification read, toast, then close the sheet. The open
 *  NotifSheet renders a snapshot of the notifs array captured when it opened, so
 *  it must close to reflect the change — mirrors the prototype's onReadAll. */
export function closeNotifAfterReadAll(markAllRead: () => void) {
	markAllRead();
	toasts.notify('success', '已全部標為已讀', '');
	overlay.closeSheet();
}
