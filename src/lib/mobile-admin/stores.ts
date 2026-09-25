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

import { writable, derived, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createHydrationGate } from '$lib/hydration-gate';
import { createOverlay } from '$lib/components/mobile/overlay';
import type { MobileAdminPushRegistry, MobileAdminSheetRegistry } from './overlay-registry';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import type { Role } from './nav';
// C4 批3(facade 純轉手退役):COACHES/type Coach 改直取 $lib/domain/coaches(原經
// ./data 純轉手,零附加型別事實)——這裡是 coaches store 的同步種子值(見下方),
// 非 test-only 消費。
import { MEMBERS, CLASSES, ORDERS, MESSAGES, ADMIN_NOTIFS, COACH_NOTIFS, type MemberRow, type ClassRow, type OrderRow, type MessageRow, type AdminNotif } from './data';
import { COACHES, type Coach } from '$lib/domain/coaches';
import {
	getOpsCollections,
	getMessages,
	markRead,
	createMember,
	updateMember,
	createCourse,
	updateCourse,
	createCoach,
	updateCoach,
	updateOrderStatus,
	saveNewCoach,
	saveCoachEdit,
	type CreateMemberBody,
	type UpdateMemberBody,
	type CoachFormValues,
	type SaveNewCoachOutcome,
	type SaveCoachEditOutcome,
	type OpsPages,
	type PageInfo
} from './api';
import { buildCourseBody } from '$lib/admin/components/course-request';
import { applyStatusChange } from '$lib/admin/components/orders-filter';
import type { OrderStatus } from '$lib/api/wire';

/* ---------- Overlay (push-screen stack + one bottom sheet) ----------
 * 單源於 `$lib/components/mobile/overlay`(mobile 與 mobile-admin 兩 surface 共用
 * 同一份 factory,見該檔頂端註解)——createOverlay 的直接單元測試在
 * overlay.test.ts(本檔過去純轉出 createOverlay/OverlayEntry/OverlayState 供
 * stores.test.ts 建獨立實例，零其餘消費者，已退役——ADR-0010「死值不留死出口」)；
 * overlay 單例仍由本 surface 自建(per-surface 狀態)。 */
// K6-4:push/sheet 各自的合法 id 集合由 overlay-registry.ts 的註冊表鍵推出;各 id 的
// props 由註冊元件的 props 推出,呼叫端傳錯 id / 錯 props / 漏必填 props 都在編譯期擋下。
// 註冊表只能以敘述層級 `import type` 引入(verbatimModuleSyntax 下編譯後整行抹除),
// 否則執行期會把全部 overlay 元件拉進本檔載入鏈。
export type MobileAdminPushId = keyof MobileAdminPushRegistry;
export type MobileAdminSheetId = keyof MobileAdminSheetRegistry;
export const overlay = createOverlay<MobileAdminPushRegistry, MobileAdminSheetRegistry>();

/* ---------- Notifications (mobile bell — `read` flag) ----------
 * 單源於 `$lib/stores/read-state` 的 createReadState(Admin / coach 通知鈴鐺全部
 * 標為已讀共用同一個 factory,見該檔頂端註解——不可變更新,保留 seed 陣列不被
 * 動到)。adminUnread 保留舊名(呼叫端零變動),內部直接委派 unreadCount。 */
export const adminUnread = unreadCount;
export const adminNotifs = createReadState<AdminNotif>(ADMIN_NOTIFS);
export const coachNotifs = createReadState<AdminNotif>(COACH_NOTIFS);

/* ---------- Live collections (新增 / 編輯 表單寫回) ---------- */
export const members = writable<MemberRow[]>(MEMBERS);
export const classes = writable<ClassRow[]>(CLASSES);
// 寫入不局部樂觀更新這些 store:寫入成功後一律 refreshOps() 整包重抓(見下方寫入動詞)。
export const coaches = writable<Coach[]>(COACHES);

/** Live orders, so 標記已付款 actually persists. The orders screen KPIs (本月已收
 *  revenue, 待付款 count) and the admin home 待付款 banner all derive from this
 *  store — keep it the single source of truth for order status. */
export const orders = writable<OrderRow[]>(ORDERS);

/** members/classes/orders 的分頁 meta(只抓第 1 頁,見 api.ts getOpsCollections)。頁面
 *  header 顯示 total,total > perPage 時搜尋區顯示 searchCapHint()。同步 seed 取 seed 陣列
 *  長度(perPage 同值 → 不出提示),水合後由 opsGate.apply 覆寫。 */
const _opsPages = writable<OpsPages>({
	members: { total: MEMBERS.length, perPage: MEMBERS.length },
	classes: { total: CLASSES.length, perPage: CLASSES.length },
	orders: { total: ORDERS.length, perPage: ORDERS.length }
});
export const opsPages = { subscribe: _opsPages.subscribe };

/** 行動版不能換頁,搜尋只涵蓋已抓回的第 1 頁——超過一頁時誠實提示(不照抄桌面「切換頁面」文案)。 */
export function searchCapHint(p: PageInfo): string | null {
	return p.total > p.perPage ? `僅搜尋前 ${p.perPage} 筆，完整清單請至桌面後台` : null;
}

/** 集合水合守衛(members/classes/coaches/orders 一次到位)。四個 store 都保留同步
 *  seed(對齊 mobile notifs 前例;空起始會造成跨頁讀值的行為回歸)。hydrateOps()
 *  由 classes/members/orders 任一消費頁在 onMount 觸發;markOrderPaid 呼叫
 *  opsGate.markMutated()(mutation 即宣告水合真相),防止「水合前的本地寫入」被首次
 *  水合的 seed clone 無聲清除(C1 regression)。refreshOps() 保持一律真抓,供「重新
 *  整理」/ErrorState 重試與寫入動詞的寫後重抓共用(使用者明確要求最新資料,不受 guard
 *  短路保護);架構深化 R10 起落地改走世代穩定重抓——只丟棄「refresh **進場之後**」才
 *  發生的 mutation,故「await markOrderPaid() → await refreshOps()」這種寫後重抓的正常
 *  序列零變化(fetch 恰一次、快照照常套用),只有真的在飛期間才發生的 mutation 會讓舊
 *  快照作廢、原地補抓。guard 短路 + post-await re-check(mutation 勝出)的機制本身由
 *  `createHydrationGate` 提供,見 `$lib/hydration-gate` 的模組註解。fetch 包一層箭頭
 *  函式(不直接傳函式參照)——維持原本「只有實際呼叫 hydrateOps()/refreshOps() 時才讀取
 *  getOpsCollections 這個 binding」的惰性時機,而非在本模組載入當下就讀取;純 import
 *  stores.ts 而不曾呼叫 hydrateOps()(或寫入動詞)的頁面測試,其 api mock 因此不必連帶
 *  提供 getOpsCollections。 */
const opsGate = createHydrationGate({
	fetch: () => getOpsCollections(),
	apply: (d) => {
		members.set(d.members);
		classes.set(d.classes);
		coaches.set(d.coaches);
		orders.set(d.orders);
		_opsPages.set(d.pages);
	}
});
export const opsHydrated = opsGate.hydrated;
export const hydrateOps = opsGate.hydrate;
export const refreshOps = opsGate.refresh;

/* ---------- 寫入動詞(R12:ops store 擁有自己的寫入) ----------
 * 逐 entity、新增/編輯分兩支(不做跨 entity 的通用 CRUD——ADR-0018 C6;不用 isNew 旗標
 * ——ADR-0012)。寫入失敗 → 丟出(coach 系列回 coach-save 的 outcome 原樣),頁面照舊用
 * 自己的錯誤文案表(ADR-0011)。寫入成功 → 動詞內 await 寫後重抓,呼叫端拿到 resolve 時
 * 列表已是新的;重抓失敗只 console.error、不丟出(寫入本身已成功,不該回報成失敗)。 */
async function refetchAfterWrite(): Promise<void> {
	try {
		await refreshOps();
	} catch (e) {
		console.error('[mobile-admin] 寫入成功但重抓 ops 集合失敗', e);
	}
}

export async function addMember(body: CreateMemberBody): Promise<void> {
	await createMember(body);
	await refetchAfterWrite();
}
export async function saveMember(id: string, body: UpdateMemberBody): Promise<void> {
	await updateMember(id, body);
	await refetchAfterWrite();
}

/** 課程 body 由桌面 buildCourseBody() 組(兩邊 ClassRow/Coach 形狀相同),coach_id 對照
 *  當下的 $coaches;duration_minutes 由表單另給(ClassRow 無此欄)。 */
export async function addCourse(row: ClassRow, durationMinutes: number): Promise<void> {
	await createCourse({ ...buildCourseBody(row, get(coaches)), duration_minutes: durationMinutes });
	await refetchAfterWrite();
}
export async function saveCourse(row: ClassRow, durationMinutes: number): Promise<void> {
	await updateCourse(row.id, { ...buildCourseBody(row, get(coaches)), duration_minutes: durationMinutes });
	await refetchAfterWrite();
}

/** 教練兩步寫入(coach-save.ts):失敗不丟出,outcome 原樣回傳給頁面翻譯 toast。新增不帶
 *  pendingUserId(行動版「儲存即關 sheet」,沒有同工作階段重試第二步的哨兵,見
 *  CoachesScreen.svelte 檔頭)。 */
export async function addCoach(v: CoachFormValues): Promise<SaveNewCoachOutcome> {
	const outcome = await saveNewCoach(v, null, { createMember, createCoach });
	if (outcome.kind === 'created') await refetchAfterWrite();
	return outcome;
}
export async function saveCoach(v: CoachFormValues, target: Coach): Promise<SaveCoachEditOutcome> {
	const outcome = await saveCoachEdit(v, { id: target.id, userId: target.userId, name: target.name }, { updateMember, updateCoach });
	if (outcome.kind === 'saved') await refetchAfterWrite();
	return outcome;
}

/** 標記已付款:先寫後改——PATCH /orders/{orderId}/status 成功後,用桌面同一支
 *  applyStatusChange() 把 server 回的 status 套回 $orders(以 orderId 比對,paidAt 取訂單
 *  日期,同 mapAdminOrder 的讀取規則),再 opsGate.markMutated()(防首次水合覆寫)。
 *  PATCH 已落定才 mark,沒有在飛尾流可入帳——**不帶 tail**(ADR-0021)。不重抓:KPI /
 *  橫幅都由 $orders 衍生,局部套回即足夠。PATCH 失敗 → 丟出,store 不動。 */
export async function markOrderPaid(order: OrderRow): Promise<void> {
	const res = await updateOrderStatus(order.orderId, 'paid');
	orders.update((rows) => applyStatusChange(rows, order.orderId, res.status as OrderStatus));
	opsGate.markMutated();
}

/** Live parent-message threads. The coach 訊息 badge + row highlight derive from
 *  this store, so reading a thread updates both — the static seed only ever showed
 *  the original unread count for the whole session. */
export const messages = writable<MessageRow[]>(MESSAGES.map((m) => ({ ...m })));
/** Mark a thread read (the coach opened it). Also flips `messagesHydrated` true
 *  (同 ops 集合的 markOrderPaid — mutation 即宣告水合真相,防止首次水合
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
 *  (mutation 即宣告水合真相)。refreshMessages() 保持一律真抓,供重試使用(落地同走
 *  世代穩定重抓,理由與判準見上方 opsGate 註解)。
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

/** 開通知 sheet(mobile-admin dashboard/orders/classes/members 四頁的 bell icon 共用
 *  同一顆函式——四頁原本各自維護一份 byte-identical 的本地 openNotif,onReadAll 恰等於
 *  closeNotifAfterReadAll(adminNotifs.markAllRead),收斂進此處單一具名函式)。 */
export function openAdminNotif(): void {
	overlay.sheet('notif', { notifs: get(adminNotifs), onReadAll: () => closeNotifAfterReadAll(adminNotifs.markAllRead) });
}
