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
export type CartItemType = 'course' | 'pass';

export interface CartItem {
  id: string; // backend uuid (course.id or product.id)
  type: CartItemType;
  name: string;
  price: number; // NT$ integer
  qty: number;
  icon: string;
  spots?: number;
  desc?: string;
  level?: string;
  cat?: string;
  days?: string;
}

/** A cart item before it enters the cart — the cart owns qty. */
export type CartItemInput = Omit<CartItem, 'qty'>;

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
