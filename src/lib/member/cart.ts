import { writable, derived, get, type Readable } from 'svelte/store';
import type { CatalogCourse } from '$lib/public/adapters';
import { courseToCartItem, type CartItem, type CartItemInput } from '$lib/cart-item';

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
 *  store + refreshWaitlist()/joinWaitlist()/cancelWaitlist() in the sibling
 *  `waitlist.ts` module) — an old `dreamfly_cart_v3` payload may still carry a
 *  `waitlist` array from before this change, but it's ignored on load: never
 *  rehydrated, and (since `PersistedCart` no longer has the field) never
 *  written back either. */
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
