/* Dream Fly — 行動版後台 · cross-route client state.
 *
 * The prototype (app.jsx) kept role / tab / stack / sheet / toasts / live
 * members·classes·coaches / notifs in one React component. Rendered as real
 * routes, role + tab are URLs but push-screens + sheets are overlay state; the
 * live collections, notifs and toasts are shared stores here. Factories are
 * exported for isolated test instances; the app uses the singletons.
 *
 * Task 20：members/classes/coaches/orders/messages 現由 $lib/mobile-admin/api
 * 的 getOpsCollections()/getMessages() 供給真資料(該檔組合桌面 admin/coach
 * seams 並做薄映射)——這裡的 store 本身不知道資料來源，只負責水合守衛/樂觀更新等跨路由狀態
 * 管理，見各函式附註。notifs(通知中心鈴鐺)仍為 mock，無對應後端來源。 */

import { writable, derived, get } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createHydrationGate } from '$lib/hydration-gate';
import { createSessionGate } from '$lib/session-gate';
import { createOverlay } from '$lib/components/mobile/overlay';
import type { MobileAdminPushRegistry, MobileAdminSheetRegistry } from './overlay-registry';
import { createReadState, unreadCount } from '$lib/stores/read-state';
// R15(候選 F-3，誠實開機)：MEMBERS/CLASSES/ORDERS/COACHES 同步種子已退役——
// members/classes/orders/coaches 四個 store 誠實開機為 `[]`(見下方 EMPTY_OPS),值
// 改由真 getOpsCollections() 水合。type Coach 仍直取 $lib/domain/coaches(型別本身
// 留在原處，只有 COACHES 值搬到 $lib/testing/seed-fixtures 供測試用)。
import { ADMIN_NOTIFS, COACH_NOTIFS, type MessageRow, type AdminNotif } from './data';
import type { ClassRow, MemberAccount as MemberRow, Order as OrderRow, CoachFormValues } from '$lib/admin/data';
import type { Coach } from '$lib/domain/coaches';
import { getOpsCollections, getMessages, type OpsCollections, type OpsPages, type PageInfo } from './api';
// R15 Task 3b(候選 轉手退役):createMember/updateMember/createCourse/updateCourse/
// createCoach/updateCoach/updateOrderStatus 原經 mobile-admin/api.ts 零映射
// re-export 轉手,已退役——直接向擁有者模組 $lib/admin/api 取用。
import {
	createMember,
	updateMember,
	createCourse,
	updateCourse,
	createCoach,
	updateCoach,
	updateOrderStatus,
	type CreateMemberBody,
	type UpdateMemberBody
} from '$lib/admin/api';
import { saveNewCoach, saveCoachEdit, type SaveNewCoachOutcome, type SaveCoachEditOutcome } from '$lib/admin/components/coach-save';
import { buildCreateCourseBody, buildUpdateCourseBody, type ValidCourse } from '$lib/admin/components/course-request';
// R13 Task 5(C4):applyStatusChange 搬到 order-status.ts,markOrderPaid 改共用
// changeOrderStatus 的 PATCH + 狀態碼判別(不再自己 await updateOrderStatus 後
// 直接假設成功)。
import { applyStatusChange, changeOrderStatus, type ChangeOrderStatusOutcome } from '$lib/admin/components/order-status';

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

/** 開機值 = reset 值(R15 候選 F-3，誠實開機):四個集合皆為 `[]`,分頁 meta 全為
 *  0/0——沒水合過就不假裝有資料。結構上與 opsGate 的 reset 同源(見下方),兩者
 *  都是 applyOps(EMPTY_OPS)。本檔私有——無外部消費者,不對外匯出(ADR-0010 死值不留死出口)。 */
const EMPTY_OPS: OpsCollections = {
	members: [],
	classes: [],
	coaches: [],
	orders: [],
	pages: {
		members: { total: 0, perPage: 0 },
		classes: { total: 0, perPage: 0 },
		orders: { total: 0, perPage: 0 }
	}
};

/* ---------- Live collections (新增 / 編輯 表單寫回) ---------- */
export const members = writable<MemberRow[]>(EMPTY_OPS.members);
export const classes = writable<ClassRow[]>(EMPTY_OPS.classes);
// 寫入不局部樂觀更新這些 store:寫入成功後一律 refreshOps() 整包重抓(見下方寫入動詞)。
export const coaches = writable<Coach[]>(EMPTY_OPS.coaches);

/** Live orders, so 標記已付款 actually persists. The orders screen KPIs (本頁已收
 *  revenue, 待付款 count) and the admin home 待付款 banner all derive from this
 *  store — keep it the single source of truth for order status. */
export const orders = writable<OrderRow[]>(EMPTY_OPS.orders);

/** members/classes/orders 的分頁 meta(只抓第 1 頁,見 api.ts getOpsCollections)。頁面
 *  header 顯示 total,total > perPage 時搜尋區顯示 searchCapHint()。誠實開機(R15 候選
 *  F-3):開機值全為 0/0(不出提示),水合後由 opsGate.apply 覆寫。 */
const _opsPages = writable<OpsPages>(EMPTY_OPS.pages);
export const opsPages = { subscribe: _opsPages.subscribe };

/** apply/reset 共用的套用函式(R15 候選 F-3):把 OpsCollections 整包寫回四個 store +
 *  分頁 meta,結構上保證開機值與 reset 值同源(皆呼叫 applyOps(EMPTY_OPS))。 */
function applyOps(d: OpsCollections): void {
	members.set(d.members);
	classes.set(d.classes);
	coaches.set(d.coaches);
	orders.set(d.orders);
	_opsPages.set(d.pages);
}

/** 行動版不能換頁,搜尋只涵蓋已抓回的第 1 頁——超過一頁時誠實提示(不照抄桌面「切換頁面」文案)。 */
export function searchCapHint(p: PageInfo): string | null {
	return p.total > p.perPage ? `僅搜尋前 ${p.perPage} 筆，完整清單請至桌面後台` : null;
}

/** 集合水合守衛(members/classes/coaches/orders 一次到位)。誠實開機(R15 候選
 *  F-3):開機值 = reset 值 = EMPTY_OPS(四個 store 皆為 `[]`,分頁 meta 全為 0/0)——
 *  沒水合過就不假裝有資料,不再走「同步 seed、水合只是覆寫一次」的舊慣例。hydrateOps()
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
	apply: applyOps,
	reset: () => applyOps(EMPTY_OPS)
});
export const opsHydrated = opsGate.hydrated;
/** 測試出口:閘門還原開機態(內容回到 EMPTY_OPS + 旗標 + 在飛 GET + 尾流帳)。production 不得引用。 */
export const resetOpsForTests = opsGate.reset;
export const hydrateOps = opsGate.hydrate;
export const refreshOps = opsGate.refresh;
/** 頁面進場包(R14 F1):classes/members/orders 三頁與 CoachesScreen 一律
 *  `createLoadGate({ ...opsPageEntry })`——寫入由閘門的資料來源依頁面 load-gate 交來的 isCurrent
 *  把關,卸載後或被新一輪取代的重整不再寫共享 store。hydrateOps/refreshOps 仍留給首頁與
 *  refetchAfterWrite。 */
export const opsPageEntry = opsGate.pageEntry();

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

/** 課程 body 由桌面 course-request.ts 組(R13 Task 4):ClassForm 已驗證成 ValidCourse
 *  (coach_id 在表單端對照 $coaches 解出),這裡只挑 POST/PATCH 對應的 builder。 */
export async function addCourse(course: ValidCourse): Promise<void> {
	await createCourse(buildCreateCourseBody(course));
	await refetchAfterWrite();
}
export async function saveCourse(id: string, course: ValidCourse): Promise<void> {
	await updateCourse(id, buildUpdateCourseBody(course));
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

/** 標記已付款:先寫後改——PATCH /orders/{orderId}/status 成功(changed)後,用桌面
 *  同一支 applyStatusChange() 把 server 回的 status 套回 $orders(以 orderId 比對,
 *  paidAt 取訂單日期,同 mapAdminOrder 的讀取規則),再 opsGate.markMutated()(防
 *  首次水合覆寫)。PATCH 已落定才 mark,沒有在飛尾流可入帳——**不帶 tail**
 *  (ADR-0021)。不重抓:KPI / 橫幅都由 $orders 衍生,局部套回即足夠。
 *  R13 Task 5(C4):改回傳 changeOrderStatus 的 outcome(不再 throw)——只有
 *  'changed' 才套回 store + markMutated();illegalTransition/pointsShortfall/
 *  failed 皆不動 store,由呼叫端(OrderSheet)依 kind 翻繁中 toast。 */
export async function markOrderPaid(order: OrderRow): Promise<ChangeOrderStatusOutcome> {
	const outcome = await changeOrderStatus(order.orderId, 'paid', { updateOrderStatus });
	if (outcome.kind === 'changed') {
		orders.update((rows) => applyStatusChange(rows, order.orderId, outcome.status));
		opsGate.markMutated();
	}
	return outcome;
}

/** Live parent-message threads. The coach 訊息 badge + row highlight derive from
 *  this store, so reading a thread updates both — the static seed only ever showed
 *  the original unread count for the whole session. 誠實開機(R14 候選 F3):開機值 =
 *  reset 值 = `[]`,教練分區的 layout 暖機後才顯示真數(不再顯示種子的假 3 則)。 */
export const messages = writable<MessageRow[]>([]);
/** Mark a thread read (the coach opened it). Also flips `messagesHydrated` true
 *  (同 ops 集合的 markOrderPaid — mutation 即宣告水合真相,防止首次水合
 *  覆寫)。R14(候選 F5)：真正的 PATCH /conversations/{id}/read(markRead)已搬進
 *  $lib/coach/messages-controller 的 selectThread()，由 MessageThread.svelte 呼叫端
 *  等 badgeCleared(該 PATCH 的 ack)為 true 才呼叫本函式——本函式因此只做「本地翻
 *  已讀 + 宣告水合真相」兩件事，不再自帶網路呼叫(取代 Task 20 的 fire-and-forget
 *  best-effort 版本;失敗時維持未讀，同桌面)。 */
export function markMessageRead(id: string) {
	messages.update((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m)));
	messagesGate.markMutated();
}
export const coachMsgUnread = derived(messages, ($m) => $m.filter((x) => x.unread).length);

/** 訊息水合守衛 — 與 orders/classes/members/coaches 的 ops 集合屬不同領域(coach
 *  訊息串列 vs 管理端營運集合),故獨立一套守衛,不併入 opsGate。開機為 `[]`(R14 F3
 *  誠實開機;原同步 seed 退役,值搬進 $lib/testing/seed-fixtures);markMessageRead 呼叫 messagesGate.markMutated()
 *  (mutation 即宣告水合真相)。訊息頁經 messagesPageEntry 建 load-gate,重試走 load-gate
 *  的 refresh(一律真抓、落地同走世代穩定重抓,理由與判準見上方 opsGate 註解)。
 *  R13 Task 7(C6):對話列表是**登入教練本人**的資料,改用 createSessionGate——換帳號/
 *  登出即重置回 boot 態、旗標翻回 false,在飛的舊回應由 epoch 核對作廢(原本的 hydration
 *  gate 跨帳號存活,第二位教練會看到前一位的對話列表)。opsGate 是全機構的營運集合,
 *  不涉個人隱私,維持不動。reset 回 `[]` 滿足 boot-parity(開機值 = reset 值)。
 *  暖機:routes/mobile-admin/+layout.svelte 只在教練分區以身分為 key 呼叫 hydrateMessages
 *  (見 $lib/store-warm)。
 *  fetch 包一層箭頭函式,理由同 opsGate——維持惰性讀取 getMessages 這個 binding 的時機。 */
const messagesGate = createSessionGate({
	fetch: () => getMessages(),
	apply: (d) => {
		messages.set(d);
	},
	reset: () => {
		messages.set([]);
	}
});
export const messagesHydrated = messagesGate.hydrated;
/** 測試出口:整顆閘門還原開機態(內容 + 旗標 + 在飛 GET + 尾流帳 + 兩條鏈)。production 不得引用。 */
export const resetMessagesForTests = messagesGate.reset;
export const hydrateMessages = messagesGate.hydrate;
/** 訊息頁的進場包(R14 F1);fetch 是帶 epoch 核對的那一支(session 閘門繼承自水合閘門)。 */
export const messagesPageEntry = messagesGate.pageEntry();

/* ---------- Toasts (above the tab bar, 2800ms — canonical store) ---------- */
export const toasts = createToasts(2800);

/* ---------- Convenience derived counts ---------- */
export const adminUnreadCount = derived(adminNotifs, ($n) => adminUnread($n));
export const coachUnreadCount = derived(coachNotifs, ($n) => adminUnread($n));

/** Mark every bell notification read, toast, then close the sheet. The open
 *  NotifSheet renders a snapshot of the notifs array captured when it opened, so
 *  it must close to reflect the change — mirrors the prototype's onReadAll. */
export function closeNotifAfterReadAll(markAllRead: () => void) {
	markAllRead();
	toasts.notify('success', '已全部標為已讀', '');
	overlay.closeSheet();
}

/** 開通知 sheet 的共用實作:onReadAll 恰等於 closeNotifAfterReadAll(store.markAllRead)。 */
function openNotifSheet(store: typeof adminNotifs): void {
	overlay.sheet('notif', { notifs: get(store), onReadAll: () => closeNotifAfterReadAll(store.markAllRead) });
}

/** 開通知 sheet(mobile-admin dashboard/orders/classes/members 四頁的 bell icon 共用
 *  同一顆函式——四頁原本各自維護一份 byte-identical 的本地 openNotif,收斂進此處單一具名函式)。 */
export function openAdminNotif(): void {
	openNotifSheet(adminNotifs);
}

/** 教練四頁(today/attendance/students/messages)的 bell icon 共用。 */
export function openCoachNotif(): void {
	openNotifSheet(coachNotifs);
}
