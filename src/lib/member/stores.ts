/* Dream Fly — 會員中心 · cross-route client state.
 *
 * The prototype kept cart / points / notifications / toasts in the top-level
 * React component. Because we render the member centre as real SvelteKit routes,
 * that shared state lives in these module stores instead. Mock-only, no backend. */

import { writable, derived, type Readable } from 'svelte/store';
import {
  ME,
  NOTIFS_SEED,
  POINTS_LEDGER,
  type CartItem,
  type CatalogCourse,
  type LedgerEntry,
  type Notification
} from './data';

/* ---- Cart ---- */
export type AddResult = 'added' | 'bumped' | 'waitlisted';

export function createCart() {
  const { subscribe, update, set } = writable<CartItem[]>([]);
  // 候補登記:額滿(spots 0)課程不進付費購物車,改記在此(去重、冪等)。
  const waitlist = writable<number[]>([]);
  return {
    subscribe,
    waitlist,
    /** Add a course, or bump qty if already in the cart. A full course
     *  (spots 0) is recorded on the waitlist instead of entering the paid cart.
     *  Returns which happened so the caller can show the right toast. */
    add(course: CatalogCourse): AddResult {
      if (course.spots === 0) {
        waitlist.update((ids) => (ids.includes(course.id) ? ids : [...ids, course.id]));
        return 'waitlisted';
      }
      let result: AddResult = 'added';
      update((items) => {
        if (items.some((x) => x.id === course.id)) {
          result = 'bumped';
          return items.map((x) => (x.id === course.id ? { ...x, qty: x.qty + 1 } : x));
        }
        return [...items, { ...course, qty: 1 }];
      });
      return result;
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
export const cart = createCart();

/* ---- Points ---- */
export const points = writable<number>(ME.points);
// Ledger lives in a store too, so a redemption (which lowers `points`) stays in
// sync with the visible history across route navigation.
export const pointsLedger = writable<LedgerEntry[]>(POINTS_LEDGER.map((e) => ({ ...e })));

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
