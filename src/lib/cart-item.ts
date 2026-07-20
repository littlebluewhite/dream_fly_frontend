/* Dream Fly — unified cart item type + adapters, shared across surfaces.
 *
 * Moved out of the member surface facade (`member/data.ts`) so a neutral
 * lib-root module carries it — mirrors the existing checkout-math /
 * checkout-gate / checkout-order convention. Pure relocation: content below
 * is unchanged from its original spot in member/data.ts. */

/* ---- Unified cart item (auth-at-checkout) — cart v3 ----
 * One cart holds two product sources — courses and passes — both keyed by the
 * backend uuid (course.id / product.id). No more number-id namespacing: the
 * store dedups by (type, id) instead, so a course and a pass can never
 * collide even if their uuids somehow matched. */
import type { IconName } from '$lib/icon-registry';

export type CartItemType = 'course' | 'pass';

export interface CartItem {
  id: string; // backend uuid (course.id or product.id)
  type: CartItemType;
  name: string;
  price: number; // NT$ integer
  qty: number;
  icon: IconName;
  spots?: number;
  desc?: string;
  level?: string;
  cat?: string;
  days?: string;
}

/** A cart item before it enters the cart — the cart owns qty. */
export type CartItemInput = Omit<CartItem, 'qty'>;

/* ---- ChargeableLine — 可計費約束（branded type，C6）----
 * 「預覽合計 ≡ 實際請款」這條不變量原本只靠呼叫端記憶維護（desktop 記得先過濾
 * 已持有的 pass、mobile 曾直傳整車）。C6 把它收進型別:checkoutMath（預覽）與
 * submitOrder（請款）兩個終點都只收 ChargeableLine[]，而 ChargeableLine 的唯一
 * 產地是 chargeableLines()（member/checkout）——過濾清單與請款清單從建構上同源，
 * 呼叫端繞不過去。
 *
 * 型別刻意住 lib-root（此檔）而非 member facade:消費者 checkout-math /
 * checkout-order 都在 lib-root，不得反向 import member;brand 放這裡才不會開一條
 * domain → member 的反向依賴邊（鏡射 CartItem/IconName 的既有落腳慣例）。
 * CHARGEABLE 是 nominal 標記（unique symbol，編譯後零 runtime 表徵），只讓型別
 * 系統分辨「已過濾」與「未過濾」的購物車行，不改變執行期形狀。 */
declare const CHARGEABLE: unique symbol;
export type ChargeableLine = CartItem & { readonly [CHARGEABLE]: true };

/* ---- Adapters: public/marketing API-shaped objects → unified cart item ----
 * Consume Task 14's public-surface types (uuid string ids) directly — the
 * `PublicCatalogCourse` alias predates Task 11's P2 cleanup (this file used to
 * also re-export a same-named, unrelated member-domain `CatalogCourse`,
 * numeric id); kept as-is here to avoid an unrelated rename. */
import type { CatalogCourse as PublicCatalogCourse, Ticket } from '$lib/public/adapters';

/** type:'course', qty always 1 — a course is an enrolment, not a quantity;
 *  a repeat add bumps (see stores.ts) rather than accumulating qty. */
export function courseToCartItem(c: PublicCatalogCourse): CartItem {
  return {
    id: c.id,
    type: 'course',
    name: c.name,
    price: c.price,
    qty: 1,
    icon: 'sparkles', // CatalogCourse carries no icon; supply a sensible default
    spots: c.spots,
    desc: c.desc,
    level: c.level,
    cat: c.cat,
    days: c.days
  };
}

/** type:'pass' — a single entitlement, locked at qty 1 (see stores.ts). */
export function passToCartItem(t: Ticket): CartItem {
  return {
    id: t.id,
    type: 'pass',
    name: t.name,
    price: t.price,
    qty: 1,
    icon: 'ticket',
    desc: t.desc
  };
}
