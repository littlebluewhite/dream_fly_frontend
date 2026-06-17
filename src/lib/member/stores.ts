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

/* ---- Notifications ---- */
export const notifications = writable<Notification[]>(NOTIFS_SEED.map((n) => ({ ...n })));
export const unreadCount: Readable<number> = derived(notifications, ($n) =>
  $n.filter((n) => !n.read).length
);

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
