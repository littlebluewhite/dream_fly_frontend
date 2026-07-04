/* Dream Fly — 會員中心 · cross-route client state.
 *
 * The prototype kept cart / points / notifications / toasts in the top-level
 * React component. Because we render the member centre as real SvelteKit routes,
 * that shared state lives in these module stores instead. Mock-only, no backend. */

import { writable, derived, get, type Readable } from 'svelte/store';
import { createToasts } from '$lib/stores/toasts';
import { api } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';
import {
  ME,
  NOTIFS_SEED,
  POINTS_LEDGER,
  SUBS_SEED,
  type CartItem,
  type CartItemInput,
  type CatalogCourse,
  type LedgerEntry,
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
  waitlist: string[];
}

function loadCart(): PersistedCart {
  if (typeof window === 'undefined') return { items: [], waitlist: [] };
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return { items: [], waitlist: [] };
    const parsed = JSON.parse(stored);
    return { items: parsed.items ?? [], waitlist: parsed.waitlist ?? [] };
  } catch (error) {
    console.error('Failed to load cart from storage:', error);
    return { items: [], waitlist: [] };
  }
}

/** Create a cart. Pass `persist: true` to back it with localStorage — the
 *  single app-wide cart does this so a guest cart survives login / reload.
 *  Tests use the non-persisting default so multiple carts never share storage. */
export function createCart(persist = false) {
  const initial = persist ? loadCart() : { items: [], waitlist: [] };
  const items = writable<CartItem[]>(initial.items);
  const { subscribe, update, set } = items;
  // 候補登記:額滿(spots 0)課程不進付費購物車,改記在此(去重、冪等)。
  const waitlist = writable<string[]>(initial.waitlist);

  if (persist && typeof window !== 'undefined') {
    const save = () => {
      try {
        localStorage.setItem(
          CART_STORAGE_KEY,
          JSON.stringify({ items: get(items), waitlist: get(waitlist) })
        );
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    };
    items.subscribe(save);
    waitlist.subscribe(save);
  }

  /** Add any pre-adapted item (course / pass). Dedup is by (type, id) — a
   *  course and a pass can never collide even if their ids somehow matched.
   *  A full course (spots 0) never enters the paid cart; it's routed to the
   *  waitlist instead. Neither a course (enrolment) nor a pass (entitlement)
   *  accumulates qty on a repeat add — both lock at qty 1 and report
   *  'bumped' so the caller can show the right toast. */
  function addItem(input: CartItemInput): AddResult {
    if (input.type === 'course' && input.spots === 0) {
      waitlist.update((ids) => (ids.includes(input.id) ? ids : [...ids, input.id]));
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
    waitlist,
    addItem,
    /** Add a member-catalog course (the not-yet-migrated member surface's own
     *  catalog — numeric id; see Task 17). Normalises the id to the cart's
     *  uuid-string CartItem shape and otherwise delegates entirely to
     *  addItem, so waitlist/bump behaviour stays identical for both sources. */
    add(course: CatalogCourse): AddResult {
      return addItem({ ...course, id: String(course.id), type: 'course' });
    },
    remove(id: string) {
      update((items) => items.filter((x) => x.id !== id));
    },
    updateQty(id: string, delta: number) {
      update((items) =>
        items.map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x))
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

/* ---- Points ---- */
export const points = writable<number>(ME.points);
// Ledger lives in a store too, so a redemption (which lowers `points`) stays in
// sync with the visible history across route navigation.
export const pointsLedger = writable<LedgerEntry[]>(POINTS_LEDGER.map((e) => ({ ...e })));

/* ---- Subscriptions / entitlements ----
 * Unlike points, entitlements PERSIST (localStorage) — a paid pass must survive
 * reload / re-login, so the system always knows what the member is subscribed to. */
const SUBS_STORAGE_KEY = 'dreamfly_subscriptions';
function loadSubs(): Subscription[] {
  if (typeof window === 'undefined') return SUBS_SEED.map((s) => ({ ...s }));
  try {
    const stored = localStorage.getItem(SUBS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : SUBS_SEED.map((s) => ({ ...s }));
  } catch (error) {
    console.error('Failed to load subscriptions from storage:', error);
    return SUBS_SEED.map((s) => ({ ...s }));
  }
}
export const subscriptions = writable<Subscription[]>(loadSubs());
if (typeof window !== 'undefined') {
  subscriptions.subscribe((subs) => {
    try {
      localStorage.setItem(SUBS_STORAGE_KEY, JSON.stringify(subs));
    } catch (error) {
      console.error('Failed to save subscriptions to storage:', error);
    }
  });
}

/* ---- Checkout — 真訂單 API 接縫（Task 16） ----
 * 取代原本本地結算的 commitCheckout+applyOrder 組合：金額/點數/報名/訂閱一律由
 * 後端算，前端只負責把購物車同步過去、送出訂單、再把 subscriptions/points 從
 * 後端 hydrate 回 store。commitCheckout/CheckoutResult 仍留在 checkout.ts（其
 * 測試套件保留），但已不再是真結帳路徑上的一環。 */

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

export interface ApiPointsMe {
  balance: number;
}

/** 購物車同步到後端：先 DELETE 清空 server 端購物車，再逐項 POST /cart/items（upsert）。
 *  課程項目一律送 quantity 1 — 後端 DB constraint 也強制課程 qty=1，但
 *  CartDropdown 的 stepper 目前可把本地課程 qty 推超過 1（既有 UI 缺口，非本次
 *  範圍），這裡夾回 1，不讓本地缺口污染後端訂單。方案項目照本地 qty 送出。 */
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
  await syncCartToServer(get(cart));
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
 *  product/course id 去比對「是否已持有」，不是拿 subscription 自己的 id。 */
export async function refreshSubscriptions(): Promise<void> {
  const list = await api<ApiSubscription[]>('/subscriptions/me');
  subscriptions.set(
    list
      .filter((s) => s.status === 'active')
      .map((s) => ({ id: s.product_id, name: s.product_name, since: s.started_at.slice(0, 10), price: ntd(s.price_cents) }))
  );
}

/** 點數餘額 — 從 GET /points/me 重新 hydrate。ledger 明細留給會員中心頁面
 *  （Task 17）另外接線，這裡只需要 checkout 用得到的餘額數字。 */
export async function refreshPoints(): Promise<void> {
  const data = await api<ApiPointsMe>('/points/me');
  points.set(data.balance);
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

/* ---- Cross-route UI state ---- */
export const checkoutOpen = writable(false);
export const search = writable('');

/* ---- Toasts (member, bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();
