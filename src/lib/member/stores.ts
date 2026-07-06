/* Dream Fly — 會員中心 · cross-route client state.
 *
 * The prototype kept cart / points / notifications / toasts in the top-level
 * React component. Because we render the member centre as real SvelteKit routes,
 * that shared state lives in these module stores instead. Since Tasks 16-17 the
 * checkout / subscriptions / points / notifications state is backed by the real
 * API (hydrated via the refresh* functions below); only the cart itself stays a
 * local store, synced to the server at checkout time (syncCartToServer). */

import { writable, derived, get, type Readable } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { api, ApiError } from '$lib/api/client';
import { ntd, type CatalogCourse } from '$lib/public/adapters';
import { chargeableLines } from './checkout';
import {
  NOTIFS_SEED,
  POINTS_LEDGER,
  SUBS_SEED,
  courseToCartItem,
  mapNotification,
  type ApiNotification,
  type CartItem,
  type CartItemInput,
  type LedgerEntry,
  type LedgerType,
  type Notification,
  type Subscription
} from './data';

/* ---- Cart ---- */
export type AddResult = 'added' | 'bumped' | 'waitlisted';

// cart v3: uuid string ids replace the mock-era number-id namespaces. No
// v2→v3 migration — mock-era number ids are meaningless against the real
// backend, so switching keys lets an old (v2) cart simply expire; its data
// is left untouched in localStorage, just never read again.
const CART_STORAGE_KEY = 'dreamfly_cart_v3';

interface PersistedCart {
  items: CartItem[];
}

/** Task 3 (round 2): waitlist truth moved to the server (see the `waitlist`
 *  store + refreshWaitlist()/joinWaitlist()/cancelWaitlist() below) — an old
 *  `dreamfly_cart_v3` payload may still carry a `waitlist` array from before
 *  this change, but it's ignored on load: never rehydrated, and (since
 *  `PersistedCart` no longer has the field) never written back either. */
function loadCart(): PersistedCart {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return { items: [] };
    const parsed = JSON.parse(stored);
    const items: CartItem[] = parsed.items ?? [];
    // FE#13 item 2：round-1 把 updateQty 對課程鎖 1 之前持久化的舊購物車，課程行
    // 仍可能帶著 qty>1（badge/預覽會顯示 3×，結帳仍只請款 1×——方向對使用者有
    // 利但畫面誤導）。課程是報名不是數量，載入時一次性 clamp 為 1；pass 的 qty
    // 不受影響。
    return { items: items.map((item) => (item.type === 'course' && item.qty !== 1 ? { ...item, qty: 1 } : item)) };
  } catch (error) {
    console.error('Failed to load cart from storage:', error);
    return { items: [] };
  }
}

/** Create a cart. Pass `persist: true` to back it with localStorage — the
 *  single app-wide cart does this so a guest cart survives login / reload.
 *  Tests use the non-persisting default so multiple carts never share storage. */
export function createCart(persist = false) {
  const initial = persist ? loadCart() : { items: [] };
  const items = writable<CartItem[]>(initial.items);
  const { subscribe, update, set } = items;

  if (persist && typeof window !== 'undefined') {
    const save = () => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: get(items) }));
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    };
    items.subscribe(save);
  }

  /** Add any pre-adapted item (course / pass). Dedup is by (type, id) — a
   *  course and a pass can never collide even if their ids somehow matched.
   *  A full course (spots 0) never enters the paid cart — the caller is
   *  expected to call joinWaitlist() itself on a 'waitlisted' result (see
   *  routes/member/courses/+page.svelte); this guard has no dedup
   *  responsibility of its own any more, that's the backend's 409. Neither a
   *  course (enrolment) nor a pass (entitlement) accumulates qty on a repeat
   *  add — both lock at qty 1 and report 'bumped' so the caller can show the
   *  right toast. */
  function addItem(input: CartItemInput): AddResult {
    if (input.type === 'course' && input.spots === 0) {
      return 'waitlisted';
    }
    let result: AddResult = 'added';
    update((list) => {
      const existing = list.find((x) => x.id === input.id && x.type === input.type);
      if (existing) {
        result = 'bumped';
        return list; // qty stays 1 — enrolments/entitlements aren't quantities
      }
      return [...list, { ...input, qty: 1 }];
    });
    return result;
  }

  return {
    subscribe,
    addItem,
    /** Add a course from the member catalog (Task 17: now the same public-seam
     *  CatalogCourse the marketing course list uses — uuid id, no icon field).
     *  Delegates to the same courseToCartItem adapter the marketing surface
     *  already uses, so both sources fill the missing icon identically and
     *  waitlist/bump behaviour stays identical. */
    add(course: CatalogCourse): AddResult {
      return addItem(courseToCartItem(course));
    },
    remove(id: string) {
      update((items) => items.filter((x) => x.id !== id));
    },
    /** 課程是報名（enrolment）不是數量：updateQty 對 course 一律 no-op，qty 鎖 1
     *  （後端 DB constraint 也強制課程 qty=1；本地若能推超過 1，預覽會顯示 3×
     *  金額、實際卻只請款 1× —— 同意金額與請款金額漂移）。pass 行為維持不變：
     *  加購去重已鎖 1，目前沒有任何 UI 會對 pass 呼叫這裡。 */
    updateQty(id: string, delta: number) {
      update((items) =>
        items.map((x) =>
          x.id === id && x.type !== 'course' ? { ...x, qty: Math.max(1, x.qty + delta) } : x
        )
      );
    },
    clear() {
      set([]);
    }
  };
}
/** The single app-wide cart — persisted so a guest cart survives login. */
export const cart = createCart(true);
/** Total quantity across cart lines — the header / topbar badge source.
 *  Sums qty, so a course with qty 3 counts as 3 (not 1 line). */
export const cartCount: Readable<number> = derived(cart, ($items) =>
  $items.reduce((sum, item) => sum + item.qty, 0)
);

/* ---- Waitlist (候補) — Task 3（feat/backend-integration round 2）----
 * 取代原本掛在 cart 底下、隨 dreamfly_cart_v3 一起存進 localStorage 的
 * `waitlist: string[]`——truth 改成 server（GET /waitlist/me），跟 subscriptions
 * /points 同一種「per-session 快取」模式：refreshWaitlist() 整包 hydrate；
 * joinWaitlist()/cancelWaitlist() 呼叫 API 成功後直接更新 store（不重新整包
 * fetch，省一次 GET）。cart.addItem 仍會把額滿課程擋在付費購物車外（回傳
 * 'waitlisted'），但不再自己寫入任何本地清單——呼叫端（courses 頁的
 * addToCart）收到 'waitlisted' 後才真的呼叫 joinWaitlist()。 */
export interface WaitlistEntry {
  id: string; // waitlist entry id — cancelWaitlist(id) 需要
  course_id: string;
  course_name: string;
}

interface ApiWaitlistEntry {
  id: string;
  course_id: string;
  course_name: string;
  status: 'waiting' | 'cancelled';
  created_at: string;
}

export const waitlist = writable<WaitlistEntry[]>([]);

function toWaitlistEntry(w: ApiWaitlistEntry): WaitlistEntry {
  return { id: w.id, course_id: w.course_id, course_name: w.course_name };
}

/** GET /waitlist/me — 純陣列、新到舊，含已取消的歷史紀錄。只留 status='waiting'
 *  （同 refreshSubscriptions 對 expired/cancelled 的處理慣例——已取消的候補不
 *  算「候補中」，不該顯示在會員中心的候補清單）。 */
export async function refreshWaitlist(): Promise<void> {
  const list = await api<ApiWaitlistEntry[]>('/waitlist/me');
  waitlist.set(list.filter((w) => w.status === 'waiting').map(toWaitlistEntry));
}

/** POST /waitlist（帶 course_id）。成功即代表已加入候補：把後端回傳的新 entry
 *  直接塞進 store 最前面（同 GET /waitlist/me 的新到舊排序），不用整包重新
 *  hydrate。重複候補（後端 409 "already on waitlist"）由呼叫端用
 *  joinWaitlistErrorMessage(err) 轉繁中文案；這裡原樣拋出錯誤，不吞。 */
export async function joinWaitlist(courseId: string): Promise<WaitlistEntry> {
  const res = await api<ApiWaitlistEntry>('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId })
  });
  const entry = toWaitlistEntry(res);
  waitlist.update((list) => [entry, ...list]);
  return entry;
}

/** DELETE /waitlist/{id} → 204 No Content（同 syncCartToServer 的 DELETE /cart
 *  慣例，api() 對 204 回傳 undefined，見 client.ts）。成功後從 store 移除該筆。 */
export async function cancelWaitlist(id: string): Promise<void> {
  await api(`/waitlist/${id}`, { method: 'DELETE' });
  waitlist.update((list) => list.filter((w) => w.id !== id));
}

/** POST /waitlist 409 的繁中文案。後端訊息逐字對照 waitlist service 原始碼
 *  （dream_fly_backend/src/modules/waitlist/service.rs 的
 *  `AppError::Conflict("already on waitlist")`）——同 checkout.ts
 *  ORDER_ERROR_MESSAGES 的子字串比對慣例，只有「重複候補」有專屬文案；
 *  其餘錯誤（課程未滿班的 409、網路失敗等）落回通用 fallback。 */
export function joinWaitlistErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.message.includes('already on waitlist')) {
    return '你已經在候補名單中了';
  }
  return '加入候補失敗，請稍後再試';
}

/* ---- Leave requests（請假/補課） — Task 11（feat/backend-integration round 3）----
 * 全新 UI 流（repo 原無請假 UI，比照 Round 1 打卡 UI 先例：新寫網路層，不是替換
 * 既有 mock getter）。integration-contract.md §3.20：leave_requests 的
 * status 為 pending/approved/rejected/cancelled 四選一；核准後才可另外預約一次
 * 同課程未來場次補課（POST .../makeup），與請假申請本身是兩個分開的動作——
 * 舊 mock 版 LeaveDialog 的「同時保留補課額度」開關已不適用,一併移除。 */

export interface LeaveRequest {
  id: string;
  course_id: string;
  course_name: string;
  session_id: string;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  makeup_session_id: string | null;
  makeup_session_date: string | null;
  makeup_start_time: string | null;
  created_at: string;
}

interface ApiLeaveRequest {
  id: string;
  course_id: string;
  course_name: string;
  session_id: string;
  session_date: string;
  start_time: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  makeup_session_id: string | null;
  makeup_session_date: string | null;
  makeup_start_time: string | null;
  decided_at: string | null;
  created_at: string;
}

/** LeaveRequestResponse → LeaveRequest。decided_at 未進 UI 形狀——目前沒有畫面
 *  需要顯示決定時間，維持誠實窄化(同 api.ts 窄化 local interface 的慣例)。 */
function toLeaveRequest(r: ApiLeaveRequest): LeaveRequest {
  return {
    id: r.id,
    course_id: r.course_id,
    course_name: r.course_name,
    session_id: r.session_id,
    session_date: r.session_date,
    start_time: r.start_time,
    reason: r.reason,
    status: r.status,
    makeup_session_id: r.makeup_session_id,
    makeup_session_date: r.makeup_session_date,
    makeup_start_time: r.makeup_start_time,
    created_at: r.created_at
  };
}

export const leaveRequests = writable<LeaveRequest[]>([]);

/** GET /leave-requests/me — 純陣列、不分頁、新到舊，原樣沿用後端排序。 */
export async function refreshLeaveRequests(): Promise<void> {
  const list = await api<ApiLeaveRequest[]>('/leave-requests/me');
  leaveRequests.set(list.map(toLeaveRequest));
}

/** POST /leave-requests（帶 session_id + 選填 reason）。reason 空字串/未提供時省略
 *  該欄位（同 CouponCreateDialog 對選填 expires_at 的省略慣例），對應後端 Option
 *  語意。成功把新假單塞進 store 最前面（同 GET /leave-requests/me 的新到舊排序），
 *  不用整包重新 hydrate。404（未報名此課程/場次不存在）/422（場次已開始）/409
 *  （已有請假紀錄）原樣拋出，不吞——呼叫端用 leaveRequestErrorMessage() 轉繁中文案
 *  （這個模組後端本身就已回繁中，見該函式註解）。 */
export async function createLeaveRequest(sessionId: string, reason?: string): Promise<LeaveRequest> {
  const body: { session_id: string; reason?: string } = { session_id: sessionId };
  if (reason) body.reason = reason;
  const res = await api<ApiLeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(body) });
  const entry = toLeaveRequest(res);
  leaveRequests.update((list) => [entry, ...list]);
  return entry;
}

/** DELETE /leave-requests/{id} → 204 No Content。僅 pending 假單可取消(409 否則)；
 *  取消不是刪除——後端把狀態改成 cancelled，「我的請假」清單仍要看得到歷史紀錄
 *  （同 Order 清單保留 cancelled 訂單的慣例），所以這裡是原地更新 status，不是
 *  從 store 過濾移除(對比 cancelWaitlist：候補只認 waiting，取消後從清單消失)。 */
export async function cancelLeaveRequest(id: string): Promise<void> {
  await api(`/leave-requests/${id}`, { method: 'DELETE' });
  leaveRequests.update((list) => list.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r)));
}

/** POST /leave-requests/{id}/makeup（帶欲預約的補課場次 session_id）。成功回應含
 *  補上的 makeup_session_id/date/time，直接取代 store 裡對應的那筆（伺服器為準，
 *  不用整包重新 hydrate）。409（非 approved／已預約過／名額已滿）/422（跨課程／
 *  已開始）原樣拋出。 */
export async function bookMakeup(id: string, sessionId: string): Promise<LeaveRequest> {
  const res = await api<ApiLeaveRequest>(`/leave-requests/${id}/makeup`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  });
  const entry = toLeaveRequest(res);
  leaveRequests.update((list) => list.map((r) => (r.id === id ? entry : r)));
  return entry;
}

/** leave 模組的後端錯誤字串本身就是繁中，逐字對照 integration-contract.md §3.20
 *  引用的 dream_fly_backend/src/modules/leave/service.rs AppError 訊息（例如
 *  「場次已開始，無法請假」「此場次已有請假紀錄」「該場次名額已滿」）——跟
 *  orderErrorMessage/joinWaitlistErrorMessage 需要子字串對照英文訊息不同,這裡
 *  直接透傳即可,也天然涵蓋同一 status 底下的多種原因(例如 makeup 的 409 有三種
 *  可能：非 approved／已預約過／名額已滿)。建立/取消/預約補課共用同一份文案邏輯。 */
export function leaveRequestErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return '連線發生問題，請稍後再試。';
}

/* ---- Course sessions（GET /courses/{id}/sessions，供請假/補課選場次；
 * integration-contract.md §3.18）---- */

export interface CourseSession {
  id: string;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

interface ApiCourseSession {
  id: string;
  course_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

/** 需登入,不帶 from/to——沿用後端預設範圍(今天起 28 天),足夠列出「未來場次」供
 *  請假/補課挑選,brief 未要求可調整範圍。 */
export async function getCourseSessions(courseId: string): Promise<CourseSession[]> {
  const list = await api<ApiCourseSession[]>(`/courses/${courseId}/sessions`);
  return list.map((s) => ({ id: s.id, session_date: s.session_date, start_time: s.start_time, end_time: s.end_time }));
}

/* ---- Points ----
 * 種子 0（fail-safe：折抵預覽寧可少報、絕不拿虛構餘額多報）——真實餘額由
 * refreshPoints 水合：getDashboard / getAccount / getPoints 進頁時，以及
 * CheckoutDialog 每次開啟時都會觸發。 */
export const points = writable<number>(0);
// Ledger lives in a store too, so a redemption (which lowers `points`) stays in
// sync with the visible history across route navigation.
export const pointsLedger = writable<LedgerEntry[]>(POINTS_LEDGER.map((e) => ({ ...e })));

/* ---- Subscriptions / entitlements ----
 * Task 17: localStorage persistence removed — truth is the server now
 * (GET /subscriptions/me via refreshSubscriptions, called from getAccount()
 * and after placeOrder()). A client-cached snapshot could out-live the real
 * entitlement (e.g. an admin-side change) with no event to invalidate it, so
 * the store simply starts empty/seeded and is hydrated on demand instead. */
export const subscriptions = writable<Subscription[]>(SUBS_SEED.map((s) => ({ ...s })));

/* ---- Checkout — 真訂單 API 接縫（Task 16） ----
 * 取代原本本地結算的 commitCheckout+applyOrder 組合（兩者已於 final review 移除）：
 * 金額/點數/報名/訂閱的商業規則一律以後端為準，前端只負責把「可計費項目」
 * （chargeableLines）同步過去、送出訂單、再把 subscriptions/points 從後端
 * hydrate 回 store。 */

export interface ApiOrderItem {
  id: string;
  item_type: 'product' | 'course';
  product_id: string | null;
  course_id: string | null;
  quantity: number;
  unit_price_cents: number;
}

export interface ApiOrder {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  discount_cents: number;
  coupon_code: string | null;
  points_used: number;
  points_earned: number;
  paid_at: string | null;
  created_at: string;
  items: ApiOrderItem[];
}

export interface ApiSubscription {
  id: string;
  product_id: string;
  product_name: string;
  status: 'active' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  price_cents: number;
}

export interface ApiLedgerEntry {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  order_id: string | null;
  created_at: string;
}

export interface ApiPointsMe {
  balance: number;
  ledger: ApiLedgerEntry[];
}

/** reason → 中文 desc + 本地 LedgerType 對照。checkout_earn/checkout_redeem 依契約
 *  恆為正/負，可以直接定案；admin_adjust 可正可負且沒有專屬的 UI bucket（LedgerType
 *  只有 earn/redeem/expire 三值），借用既有兩值、依 delta 正負號分類 —— desc 文字
 *  仍誠實描述「管理員調整」，只有 badge 的分類/色調是借用近似值。 */
function describeLedgerReason(reason: string, delta: number): { type: LedgerType; desc: string } {
  switch (reason) {
    case 'checkout_earn':
      return { type: 'earn', desc: '消費獲得點數' };
    case 'checkout_redeem':
      return { type: 'redeem', desc: '消費折抵點數' };
    default:
      return delta < 0
        ? { type: 'expire', desc: '會員點數調整（扣除）' }
        : { type: 'earn', desc: '會員點數調整（增加）' };
  }
}

/** 購物車同步到後端：先 DELETE 清空 server 端購物車，再逐項 POST /cart/items（upsert）。
 *  課程項目一律送 quantity 1 — cart.updateQty 已在 store 層把課程 qty 鎖 1，
 *  這裡的夾 1 是 belt-and-suspenders：舊 session 持久化在 localStorage
 *  （dreamfly_cart_v3）的購物車仍可能帶著鎖 1 之前推上去的 qty>1 課程行。
 *  方案項目照本地 qty 送出。 */
export async function syncCartToServer(items: CartItem[]): Promise<void> {
  await api('/cart', { method: 'DELETE' });
  for (const it of items) {
    await api('/cart/items', {
      method: 'POST',
      body: JSON.stringify({
        item_type: it.type === 'pass' ? 'product' : 'course',
        item_id: it.id,
        quantity: it.type === 'course' ? 1 : it.qty
      })
    });
  }
}

/** 送出訂單 — 先同步購物車，再 POST /orders（mock payment：成功即代表付款完成，
 *  見 integration-contract.md §1.8）。idempotencyKey 未指定時每次呼叫各自產生
 *  一把新 uuid；同一次結帳流程重試時，呼叫端（CheckoutDialog）需自行保留並重
 *  複傳入同一把 key，後端才會辨識為重放、回傳原訂單而不重複扣款/建立報名訂閱
 *  （見 §1.7）。成功後把 subscriptions/points 從後端重新 hydrate、清空本地購
 *  物車；任何失敗（400 購物車為空/優惠碼無效、409 滿班/已報名/點數不足等）一
 *  律不清空本地購物車、不 hydrate，原樣把錯誤丟給呼叫端處理（顯示 toast）。 */
export async function placeOrder(
  coupon: string,
  usePoints: boolean,
  idempotencyKey: string = crypto.randomUUID()
): Promise<ApiOrder> {
  // 只同步「可計費項目」— 與 CheckoutDialog 預覽用同一個 chargeableLines 過濾
  // （已持有的 pass 不進 server 購物車）。預覽合計跳過的項目絕不能被請款：
  // 同意的金額 ≡ 實際請款的金額，靠同一個過濾函式從建構上保證。
  await syncCartToServer(chargeableLines(get(cart), get(subscriptions)));
  const order = await api<ApiOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({ coupon_code: coupon || undefined, use_points: usePoints }),
    headers: { 'Idempotency-Key': idempotencyKey }
  });
  // 訂單此時已成立（伺服器已扣款、報名/訂閱已建立、server 端購物車已清空）—
  // 後續 hydrate 只是 best-effort 的本地同步，用 allSettled 讓其中一支網路
  // 失敗不會把「已成功的訂單」回報成失敗（呼叫序列仍是先 subscriptions 後
  // points：陣列字面量會依序同步呼叫兩個 async function 直到各自第一個 await）。
  const [subsResult, pointsResult] = await Promise.allSettled([refreshSubscriptions(), refreshPoints()]);
  if (subsResult.status === 'rejected') console.error('Failed to refresh subscriptions after checkout:', subsResult.reason);
  if (pointsResult.status === 'rejected') console.error('Failed to refresh points after checkout:', pointsResult.reason);
  cart.clear();
  return order;
}

/** 訂閱清單 — 從 GET /subscriptions/me 重新 hydrate 本地 subscriptions store。
 *  只留 status active 的項目：expired/cancelled 不算「已持有」，不該擋掉會員
 *  重新購買同一張 pass。id 換成 product_id——chargeableLines 是拿 cart item 的
 *  product/course id 去比對「是否已持有」，不是拿 subscription 自己的 id。
 *
 *  since 的日期格式(Task 16→17 parked issue的解法)：保留 ISO 切法(YYYY-MM-DD)，
 *  不改成 legacy mock 的 YYYY/MM/DD —— 帳戶頁(account/+page.svelte)同時顯示這個
 *  欄位跟 Task 17 新接的訂單 date 欄位(也是 ISO 切法)，兩者維持同一種格式互相一致
 *  比較重要，帳戶頁本身沒有依賴任何特定分隔符的字串比對邏輯，兩種格式對它來說都
 *  一樣能正常顯示。（points 頁的 pointsLedger 則是反過來選 YYYY/MM/DD——因為那裡
 *  有一段既有邏輯依賴這個格式，見 refreshPoints 的註解。） */
export async function refreshSubscriptions(): Promise<void> {
  const list = await api<ApiSubscription[]>('/subscriptions/me');
  subscriptions.set(
    list
      .filter((s) => s.status === 'active')
      .map((s) => ({ id: s.product_id, name: s.product_name, since: s.started_at.slice(0, 10), price: ntd(s.price_cents) }))
  );
}

/** 點數餘額 + 明細 — 從 GET /points/me 重新 hydrate。balance 給 checkout 用；
 *  ledger（Task 17 接線）用 date 的 YYYY/MM/DD 切法而非 ISO 切法，是因為
 *  points 頁的「本月累積」依 `date.startsWith(當月 YYYY/MM prefix)` 篩選
 *  （見 points/+page.svelte），格式依賴仍在 —— 換成 ISO 會讓那段篩選永遠不
 *  match、悄悄把統計歸零。 */
export async function refreshPoints(): Promise<void> {
  const data = await api<ApiPointsMe>('/points/me');
  points.set(data.balance);
  pointsLedger.set(
    data.ledger.map((l) => {
      const { type, desc } = describeLedgerReason(l.reason, l.delta);
      return { id: l.id, date: l.created_at.slice(0, 10).replace(/-/g, '/'), desc, type, delta: l.delta };
    })
  );
}

/* ---- Notifications ---- */
export const notifications = writable<Notification[]>(NOTIFS_SEED.map((n) => ({ ...n })));
export const unreadCount: Readable<number> = derived(notifications, ($n) =>
  $n.filter((n) => !n.read).length
);
// True once the notifications feed has been hydrated via getNotifications() on
// the first client mount; lets re-visits skip re-seeding so read-state (and the
// unread badge) survive navigation. Independent of `notifications`/`unreadCount`
// so it never affects the badge. Resettable in tests.
export const notificationsHydrated = writable(false);

/** 通知中心 — 從 GET /notifications 重新 hydrate(Task 17)。目前的呼叫端是
 *  api.ts 的 getDashboard()：會員登入後第一個會進的頁面，讓 Topbar/Sidebar 的未讀
 *  角標一開始就是真資料，不用等使用者先逛過通知頁。守衛跟 notifications 頁的
 *  load() 用同一顆 notificationsHydrated flag——已經 hydrate 過就不重覆抓，避免
 *  蓋掉使用者在通知頁的本地已讀狀態（不論是哪一邊先觸發都一樣：先到者 hydrate、
 *  後到者直接讀已經在 store 裡的資料）。type→cat/icon/tone 對照表跟 api.ts 的
 *  getNotifications() 共用 data.ts 的 mapNotification，避免兩處各自維護一份。 */
export async function refreshNotifications(): Promise<void> {
  if (get(notificationsHydrated)) return;
  const list = await api<ApiNotification[]>('/notifications');
  notifications.set(list.map(mapNotification));
  notificationsHydrated.set(true);
}

/* ---- Cross-route UI state ---- */
export const checkoutOpen = writable(false);
export const search = writable('');

/* ---- Toasts (member, bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();
