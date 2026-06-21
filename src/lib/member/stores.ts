/* Dream Fly — 會員中心 · cross-route client state.
 *
 * The prototype kept cart / points / notifications / toasts in the top-level
 * React component. Because we render the member centre as real SvelteKit routes,
 * that shared state lives in these module stores instead. Mock-only, no backend. */

import { writable, derived, get, type Readable } from 'svelte/store';
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
import type { CheckoutResult } from './checkout';

/* ---- Cart ---- */
export type AddResult = 'added' | 'bumped' | 'waitlisted';

const CART_STORAGE_KEY = 'dreamfly_cart_v2';

interface PersistedCart {
  items: CartItem[];
  waitlist: number[];
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
  const waitlist = writable<number[]>(initial.waitlist);

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

  /** Add any pre-adapted item (marketing course / pass). Courses accumulate
   *  qty; a pass is a single entitlement and never bumps past qty 1. */
  function addItem(input: CartItemInput): AddResult {
    let result: AddResult = 'added';
    update((list) => {
      const existing = list.find((x) => x.id === input.id);
      if (existing) {
        result = 'bumped';
        if (input.type === 'pass') return list; // single entitlement — locked at qty 1
        return list.map((x) => (x.id === input.id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...list, { ...input, qty: 1 }];
    });
    return result;
  }

  return {
    subscribe,
    waitlist,
    addItem,
    /** Add a member-catalog course, or bump qty if already in the cart. A full
     *  course (spots 0) is recorded on the waitlist instead of entering the paid
     *  cart. Returns which happened so the caller can show the right toast. */
    add(course: CatalogCourse): AddResult {
      if (course.spots === 0) {
        waitlist.update((ids) => (ids.includes(course.id) ? ids : [...ids, course.id]));
        return 'waitlisted';
      }
      return addItem({ ...course, type: 'course' });
    },
    remove(id: number) {
      update((items) => items.filter((x) => x.id !== id));
    },
    updateQty(id: number, delta: number) {
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

/* ---- applyOrder — store 寫入（Task 3 接縫） ----
 * 接收 commitCheckout 的純結果，統一寫入 points / pointsLedger / subscriptions / cart。
 * 不純：有副作用；不負責算錢（那是 commitCheckout 的事）。 */
export function applyOrder(result: CheckoutResult): void {
  points.update((p) => p + result.pointDelta);
  if (result.ledgerEntries.length) pointsLedger.update((p) => {
    // 全部 entry 共用同一 p.length，靠 e.type 區分 → id 唯一性賴「至多一 earn 一 redeem」不變量。
    // 結果與舊碼 'co-earn-'+len / 'co-redeem-'+len 逐字相等。
    const withIds = result.ledgerEntries.map((e) => ({ ...e, id: 'co-' + e.type + '-' + p.length }));
    return [...withIds, ...p];
  });
  if (result.newSubscriptions.length) subscriptions.update((subs) => {
    const owned = new Set(subs.map((s) => s.id));
    // owned 邊濾邊長：即使 newSubscriptions 含同 id 兩筆（不該發生）也只進一筆 → 批次冪等。
    return [...subs, ...result.newSubscriptions.filter((s) => !owned.has(s.id) && (owned.add(s.id), true))];
  });
  cart.clear();
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

/* ---- Toasts (member, bottom-right stack) ---- */
export type ToastTone = 'success' | 'info' | 'warning' | 'error';
export interface MemberToast {
  id: number;
  tone: ToastTone;
  title: string;
  body: string;
}

function createToasts() {
  const { subscribe, update } = writable<MemberToast[]>([]);
  let seq = 1;
  return {
    subscribe,
    notify(tone: ToastTone, title: string, body = '') {
      const id = seq++;
      update((t) => [...t, { id, tone, title, body }]);
      setTimeout(() => update((t) => t.filter((x) => x.id !== id)), 4000);
    },
    dismiss(id: number) {
      update((t) => t.filter((x) => x.id !== id));
    }
  };
}
export const toasts = createToasts();
