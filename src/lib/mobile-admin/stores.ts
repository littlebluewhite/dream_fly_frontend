/* Dream Fly — 行動版後台 · cross-route client state.
 *
 * The prototype (app.jsx) kept role / tab / stack / sheet / toasts / live
 * members·classes·coaches / notifs in one React component. Rendered as real
 * routes, role + tab are URLs but push-screens + sheets are overlay state; the
 * live collections, notifs and toasts are shared stores here. Factories are
 * exported for isolated test instances; the app uses the singletons.
 *
 * members/classes/coaches/orders 是 ops 集合:三個水合單位直接向桌面 $lib/admin/api 的
 * getMembers/getClasses/getOrders 取第 1 頁(見下方「ops 集合」段)。notifs(通知中心鈴鐺)
 * 仍為 mock，無對應後端來源。 */

import { writable, derived, get, type Readable } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { createHydrationGate } from '$lib/hydration-gate';
import { createOverlay } from '$lib/components/mobile/overlay';
import type { MobileAdminPushRegistry, MobileAdminSheetRegistry } from './overlay-registry';
import { createReadState, unreadCount } from '$lib/stores/read-state';
import { ADMIN_NOTIFS, COACH_NOTIFS, type AdminNotif } from './data';
import type { ClassRow, MemberAccount as MemberRow, Order as OrderRow, CoachFormValues } from '$lib/admin/data';
import type { Coach } from '$lib/domain/coaches';
import {
	getMembers,
	getClasses,
	getOrders,
	createMember,
	updateMember,
	createCourse,
	updateCourse,
	createCoach,
	updateCoach,
	type CreateMemberBody,
	type UpdateMemberBody
} from '$lib/admin/api';
import { saveNewCoach, saveCoachEdit, type SaveNewCoachOutcome, type SaveCoachEditOutcome } from '$lib/admin/components/coach-save';
import { buildCreateCourseBody, buildUpdateCourseBody, type ValidCourse } from '$lib/admin/components/course-request';

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

/* ---------- ops 集合(Ops Collections):三個水合單位 ----------
 * 會員(getMembers(1))、課程·教練(getClasses(1),一次填 classes 與 coaches)、訂單
 * (getOrders(1))各自一顆水合閘門:一支端點壞掉只有自己那一頁顯示錯誤,寫入後只刷新受影響的
 * 單位(見下方寫入動詞的刷新表)。行動版不能換頁,三個單位都只抓第 1 頁(後端預設 per_page=20),
 * 分頁 meta 進 opsPages,頁面據此顯示真實總數與 searchCapHint()。閘門由 store 擁有而不是各頁
 * 自建,是因為集合跨頁共用:教練畫面與課程頁讀同一份 coaches,首頁 banner 與訂單頁讀同一份
 * orders,寫入動詞在別頁觸發也要刷新同一份。
 *
 * 誠實開機(ADR-0025 F-3):開機值 = 重置值:集合為 `[]`、分頁 meta 為 EMPTY_OPS(三格皆 0/0)——沒水合過
 * 就不假裝有資料。每個單位只寫、只重置自己那一格 opsPages。fetch 包一層箭頭函式,只有實際水合時
 * 才讀 $lib/admin/api 的 getter binding。四個集合對外只匯出 Readable,只有閘門的 apply/reset 能寫。 */
export interface PageInfo {
	total: number;
	perPage: number;
}
export interface OpsPages {
	members: PageInfo;
	classes: PageInfo;
	orders: PageInfo;
}
const EMPTY_PAGE: PageInfo = { total: 0, perPage: 0 };
/** 本檔私有——無外部消費者(ADR-0010 死值不留死出口)。 */
const EMPTY_OPS: OpsPages = { members: EMPTY_PAGE, classes: EMPTY_PAGE, orders: EMPTY_PAGE };

const _members = writable<MemberRow[]>([]);
const _classes = writable<ClassRow[]>([]);
const _coaches = writable<Coach[]>([]);
const _orders = writable<OrderRow[]>([]);
const _opsPages = writable<OpsPages>(EMPTY_OPS);
export const members: Readable<MemberRow[]> = { subscribe: _members.subscribe };
export const classes: Readable<ClassRow[]> = { subscribe: _classes.subscribe };
export const coaches: Readable<Coach[]> = { subscribe: _coaches.subscribe };
/** Live orders (read-only on mobile since W-6 fix 1). The orders screen KPIs (本頁已收
 *  revenue, 待付款 count) and the admin home 待付款 banner all derive from this
 *  store — keep it the single source of truth for order status. */
export const orders: Readable<OrderRow[]> = { subscribe: _orders.subscribe };
export const opsPages: Readable<OpsPages> = { subscribe: _opsPages.subscribe };

const setPage = (unit: keyof OpsPages, p: PageInfo) => _opsPages.update((all) => ({ ...all, [unit]: p }));

const membersGate = createHydrationGate({
	fetch: () => getMembers(1),
	apply: (d) => {
		_members.set(d.members);
		setPage('members', { total: d.total, perPage: d.perPage });
	},
	reset: () => {
		_members.set([]);
		setPage('members', EMPTY_OPS.members);
	}
});
const classesGate = createHydrationGate({
	fetch: () => getClasses(1),
	apply: (d) => {
		_classes.set(d.classes);
		_coaches.set(d.coaches);
		setPage('classes', { total: d.total, perPage: d.perPage });
	},
	reset: () => {
		_classes.set([]);
		_coaches.set([]);
		setPage('classes', EMPTY_OPS.classes);
	}
});
const ordersGate = createHydrationGate({
	fetch: () => getOrders(1),
	apply: (d) => {
		_orders.set(d.orders);
		setPage('orders', { total: d.total, perPage: d.perPage });
	},
	reset: () => {
		_orders.set([]);
		setPage('orders', EMPTY_OPS.orders);
	}
});

/** 頁面進場包(R14 F1):members/classes/orders 三頁各用自己單位的 `createLoadGate({ ...xPageEntry })`,
 *  CoachesScreen 用 classesPageEntry——寫入由閘門依頁面 load-gate 交來的 isCurrent 把關,卸載後
 *  或被新一輪取代的重整不再寫共享 store。 */
export const membersPageEntry = membersGate.pageEntry();
export const classesPageEntry = classesGate.pageEntry();
export const ordersPageEntry = ordersGate.pageEntry();
/** 首頁待付款 banner 只需要訂單單位(best-effort,失敗由呼叫端吞掉)。 */
export const hydrateOrders = ordersGate.hydrate;
/** 測試出口:三個單位還原開機態(集合回到 `[]`、分頁 meta 回到 EMPTY_OPS + 旗標 + 在飛 GET + 尾流帳)。production 不得引用。 */
export const resetOpsForTests = (): void => { membersGate.reset(); classesGate.reset(); ordersGate.reset(); };

/** 行動版不能換頁,搜尋只涵蓋已抓回的第 1 頁——超過一頁時誠實提示(不照抄桌面「切換頁面」文案)。 */
export function searchCapHint(p: PageInfo): string | null {
	return p.total > p.perPage ? `僅搜尋前 ${p.perPage} 筆，完整清單請至桌面後台` : null;
}

/* ---------- 寫入動詞(R12:ops store 擁有自己的寫入) ----------
 * 逐 entity、新增/編輯分兩支(不做跨 entity 的通用 CRUD——ADR-0018 C6;不用 isNew 旗標
 * ——ADR-0012)。寫入失敗 → 丟出(coach 系列回 coach-save 的 outcome 原樣),頁面照舊用
 * 自己的錯誤文案表(ADR-0011)。寫入成功 → 動詞內 await 受影響單位的寫後重抓,呼叫端拿到
 * resolve 時列表已是新的。後端的訂單列表與教練列表都即時 JOIN 使用者名字(課程列的教練名
 * 又取自教練列表),所以改名會波及三個單位:
 *
 *   addMember / saveMember(名字沒變)        → 會員
 *   saveMember(改名) / saveCoach(改名)       → 會員、課程·教練、訂單
 *   addCourse / saveCourse / saveCoach(名字沒變) → 課程·教練
 *   addCoach(created)                        → 會員、課程·教練(新教練也是一個 user)
 *
 * 受影響單位同時重抓(Promise.allSettled);某個單位重抓失敗只 console.error、不丟出(寫入本身
 * 已成功,不該回報成失敗,ADR-0022 §1),其餘單位照常套用。 */
type OpsUnit = typeof membersGate;
const ALL_UNITS: OpsUnit[] = [membersGate, classesGate, ordersGate];

async function refetchAfterWrite(...units: OpsUnit[]): Promise<void> {
	const results = await Promise.allSettled(units.map((u) => u.refresh()));
	for (const r of results) {
		if (r.status === 'rejected') console.error('[mobile-admin] 寫入成功但重抓 ops 集合失敗', r.reason);
	}
}

export async function addMember(body: CreateMemberBody): Promise<void> {
	await createMember(body);
	await refetchAfterWrite(membersGate);
}
export async function saveMember(id: string, body: UpdateMemberBody): Promise<void> {
	const renamed = body.name !== undefined && body.name.trim() !== get(_members).find((m) => m.id === id)?.name;
	await updateMember(id, body);
	await refetchAfterWrite(...(renamed ? ALL_UNITS : [membersGate]));
}

/** 課程 body 由桌面 course-request.ts 組(R13 Task 4):ClassForm 已驗證成 ValidCourse
 *  (coach_id 在表單端對照 $coaches 解出),這裡只挑 POST/PATCH 對應的 builder。 */
export async function addCourse(course: ValidCourse): Promise<void> {
	await createCourse(buildCreateCourseBody(course));
	await refetchAfterWrite(classesGate);
}
export async function saveCourse(id: string, course: ValidCourse): Promise<void> {
	await updateCourse(id, buildUpdateCourseBody(course));
	await refetchAfterWrite(classesGate);
}

/** 教練兩步寫入(coach-save.ts):失敗不丟出,outcome 原樣回傳給頁面翻譯 toast。新增的
 *  pendingUserId 是上次綁定失敗留下的 user id(sheet 工作階段內由 CoachesScreen 持有),
 *  非 null 時只重打 createCoach,避免重建 user 撞 email 409。改名判準同 saveCoachEdit
 *  (trim 後與現值不同才 PATCH /users)。 */
export async function addCoach(v: CoachFormValues, pendingUserId: string | null): Promise<SaveNewCoachOutcome> {
	const outcome = await saveNewCoach(v, pendingUserId, { createMember, createCoach });
	if (outcome.kind === 'created') await refetchAfterWrite(membersGate, classesGate);
	return outcome;
}
export async function saveCoach(v: CoachFormValues, target: Coach): Promise<SaveCoachEditOutcome> {
	const outcome = await saveCoachEdit(v, { id: target.id, userId: target.userId, name: target.name }, { updateMember, updateCoach });
	if (outcome.kind === 'saved') await refetchAfterWrite(...(v.name.trim() !== target.name ? ALL_UNITS : [classesGate]));
	return outcome;
}

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
