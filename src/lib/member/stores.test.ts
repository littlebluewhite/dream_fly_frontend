import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCart, cart, cartCount, subscriptions, points, pointsLedger } from './stores';
import { ME, POINTS_LEDGER, courseToCartItem, passToCartItem } from './data';
import type { CatalogCourse, Ticket } from '$lib/public/adapters';

// The singleton cart / subscriptions persist to localStorage; reset them (and
// storage) between tests. Factory carts made with createCart() don't persist,
// so they're naturally isolated and need no reset.
beforeEach(() => {
  localStorage.clear();
  cart.clear();
  subscriptions.set([]);
  points.set(ME.points);
  pointsLedger.set(POINTS_LEDGER.map((e) => ({ ...e })));
});

// A public-catalog course fixture (uuid id) — the shape courseToCartItem consumes.
const COURSE: CatalogCourse = {
  id: 'course-uuid-1',
  name: '幼兒體操 啟蒙班',
  level: '初級',
  cat: '幼兒體操',
  age: '3–6 歲',
  days: '週六 10:00',
  price: 3200,
  hot: false,
  coach: '黃教練',
  desc: '',
  spots: 3
};
// A second, distinct public-catalog course fixture — needed wherever a test
// requires two different course ids in the same cart (e.g. persistence round-trip).
const COURSE2: CatalogCourse = {
  id: 'course-uuid-2',
  name: '兒童基礎 B 班',
  level: '基礎',
  cat: '兒童基礎',
  age: '7–9 歲',
  days: '週一 / 週三 17:30',
  price: 3200,
  hot: true,
  coach: '陳教練',
  desc: '',
  spots: 2
};
const TICKET: Ticket = {
  id: 'product-uuid-1',
  name: '單堂體驗課',
  price: 500,
  desc: '首次體驗任一課程',
  features: []
};

describe('cart waitlist guard (public-seam course path — cart.add)', () => {
  // Task 17: cart.add() now takes the same public-seam CatalogCourse (uuid id)
  // as the marketing course list, and delegates to courseToCartItem internally.
  // Task 3 (round 2): the cart no longer tracks waitlist membership itself —
  // it only guards a full course out of the paid cart. Joining the real
  // waitlist (and its dedup) is now the server's job via joinWaitlist() in
  // stores.ts's network layer (see checkout-api.test.ts).
  const full = { ...COURSE, spots: 0 };

  it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
    const c = createCart();
    const r = c.add(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0); // never enters the paid cart
  });

  it('adds a course that still has spots to the paid cart and returns "added"', () => {
    const c = createCart();
    const normal = { ...COURSE, spots: 3 };
    const r = c.add(normal);
    expect(r).toBe('added');
    expect(get(c)).toHaveLength(1);
  });

  it('returns "waitlisted" both times when the same full course is added twice — the cart has no dedup responsibility (the backend 409s a duplicate join)', () => {
    const c = createCart();
    expect(c.add(full)).toBe('waitlisted');
    expect(c.add(full)).toBe('waitlisted');
    expect(get(c)).toHaveLength(0); // still never in the paid cart
  });

  it('bumps (not waitlist) when a course with spots is added twice — qty stays 1 (enrolment, not a quantity)', () => {
    const c = createCart();
    const normal = { ...COURSE, spots: 3 };
    expect(c.add(normal)).toBe('added');
    expect(c.add(normal)).toBe('bumped');
    expect(get(c)).toHaveLength(1);
    expect(get(c)[0].qty).toBe(1);
  });
});

describe('cart — addItem (cart v3: uuid ids, dedup by (type,id))', () => {
  it('adds an adapted public course under its uuid and bumps (qty stays 1) on repeat add', () => {
    const c = createCart();
    const item = courseToCartItem(COURSE);
    expect(c.addItem(item)).toBe('added');
    expect(c.addItem(item)).toBe('bumped');
    expect(get(c)).toHaveLength(1);
    expect(get(c)[0].id).toBe('course-uuid-1');
    expect(get(c)[0].qty).toBe(1); // courses are enrolments, not quantities
  });

  it('locks a pass to qty 1 — a second add is recognised as bumped but never increments', () => {
    const c = createCart();
    const pass = passToCartItem(TICKET);
    expect(c.addItem(pass)).toBe('added');
    expect(c.addItem(pass)).toBe('bumped');
    expect(get(c)).toHaveLength(1);
    expect(get(c)[0].qty).toBe(1); // single entitlement — no qty > 1
  });

  it('routes a full public course (spots 0) straight to the waitlist guard, never the paid cart', () => {
    const c = createCart();
    const full = courseToCartItem({ ...COURSE, spots: 0 });
    const r = c.addItem(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0);
  });

  it('dedups by (type,id) — a course and a pass sharing the same id never collide', () => {
    const c = createCart();
    const sameId = 'shared-uuid';
    expect(c.addItem(courseToCartItem({ ...COURSE, id: sameId }))).toBe('added');
    expect(c.addItem(passToCartItem({ ...TICKET, id: sameId }))).toBe('added'); // NOT bumped
    expect(get(c)).toHaveLength(2);
    expect(get(c).map((x) => x.type).sort()).toEqual(['course', 'pass']);
  });
});

describe('cart persistence (survives login / reload) — dreamfly_cart_v3', () => {
  it('round-trips items through localStorage under the v3 key for a fresh persisted cart', () => {
    const c1 = createCart(true);
    c1.add({ ...COURSE, spots: 3 }); // normal → cart
    c1.add({ ...COURSE2, spots: 0 }); // full → waitlist guard (never persisted locally, see below)
    const c2 = createCart(true); // simulate a reload
    expect(get(c2)).toHaveLength(1);
    expect(localStorage.getItem('dreamfly_cart_v3')).toBeTruthy();
  });

  // Task 3 (round 2): waitlist truth moved to the server (GET /waitlist/me via
  // the module-level `waitlist` store) — the cart itself must neither read nor
  // write a `waitlist` field in dreamfly_cart_v3 any more.
  it('ignores a legacy `waitlist` array on an old dreamfly_cart_v3 payload — loads items fine, never rehydrates it, and never writes it back', () => {
    localStorage.setItem(
      'dreamfly_cart_v3',
      JSON.stringify({
        items: [{ id: 'course-uuid-9', type: 'course', name: '舊項目', price: 100, qty: 1, icon: 'sparkles' }],
        waitlist: ['stale-course-id']
      })
    );

    const c = createCart(true);

    expect(get(c)).toHaveLength(1); // items still load fine
    expect(get(c)[0].id).toBe('course-uuid-9');

    // Any subsequent save (subscribe-write-back fires on the next items mutation)
    // must not resurrect a `waitlist` key in the persisted payload.
    c.add({ ...COURSE2, spots: 3 });
    const saved = JSON.parse(localStorage.getItem('dreamfly_cart_v3')!);
    expect(saved.waitlist).toBeUndefined();
    expect(saved.items).toBeDefined();
  });

  // FE#13 item 2: a dreamfly_cart_v3 payload persisted before the round-1
  // course-qty-lock fix (cart.updateQty is now a no-op for type==='course')
  // could still carry a course line with qty>1 — badge/preview would show 3×
  // while checkout only ever charges 1× (user-favorable direction, but
  // confusing). loadCart now clamps any type==='course' line to qty 1 once on
  // load; a pass line's qty is left untouched.
  it('clamps a legacy course line with qty>1 down to 1 on load; a pass line at qty 2 is left untouched', () => {
    localStorage.setItem(
      'dreamfly_cart_v3',
      JSON.stringify({
        items: [
          { id: 'course-uuid-9', type: 'course', name: '舊課程', price: 3200, qty: 3, icon: 'sparkles' },
          { id: 'product-uuid-9', type: 'pass', name: '舊方案', price: 1800, qty: 2, icon: 'ticket' }
        ]
      })
    );

    const c = createCart(true);
    const items = get(c);

    expect(items.find((i) => i.id === 'course-uuid-9')!.qty).toBe(1);
    expect(items.find((i) => i.id === 'product-uuid-9')!.qty).toBe(2);
  });

  it('a non-persisted factory cart leaves localStorage untouched', () => {
    const before = localStorage.getItem('dreamfly_cart_v3');
    const c = createCart(); // persist defaults off
    c.add({ ...COURSE, spots: 3 });
    expect(localStorage.getItem('dreamfly_cart_v3')).toBe(before); // unchanged
  });

  it('never reads the old v2 cart key — a v2 cart from a previous release is left alone, not migrated', () => {
    localStorage.setItem('dreamfly_cart_v2', JSON.stringify({ items: [{ id: 2002, type: 'course', name: 'old', price: 1, qty: 1, icon: 'x' }], waitlist: [] }));
    const c = createCart(true);
    expect(get(c)).toHaveLength(0); // v3 cart starts fresh, ignoring v2 data
    expect(localStorage.getItem('dreamfly_cart_v2')).toBeTruthy(); // v2 data itself is left in place
  });
});

describe('cart.updateQty — course qty is locked (enrolment, not a quantity)', () => {
  it('updateQty on a course line is a no-op — qty stays 1 no matter the delta', () => {
    const c = createCart();
    c.addItem(courseToCartItem(COURSE));
    c.updateQty(COURSE.id, 1);
    c.updateQty(COURSE.id, 5);
    expect(get(c)[0].qty).toBe(1); // 課程是報名，不是數量 — 永遠鎖 1
  });
});

describe('cartCount (badge source)', () => {
  it('sums qty across lines; a course updateQty attempt can never inflate it', () => {
    cart.addItem(courseToCartItem(COURSE)); // qty 1
    cart.updateQty(COURSE.id, 1); // no-op — courses lock at qty 1
    cart.addItem(passToCartItem(TICKET)); // qty 1
    cart.updateQty(TICKET.id, 1); // pass 不在 store 層鎖（無 UI 路徑會走到）→ qty 2
    expect(get(cartCount)).toBe(3); // 1 (course) + 2 (pass qty)，兩條 line
  });
});

describe('subscriptions (truth is the server now — Task 17 removed client persistence)', () => {
  it('does NOT write entitlements to localStorage; the server (refreshSubscriptions) is the only source of truth', () => {
    subscriptions.set([{ id: 'product-uuid-1', name: '單堂體驗課', since: '2026/06/17', price: 500 }]);
    expect(localStorage.getItem('dreamfly_subscriptions')).toBeNull();
  });
});

// applyOrder（本地結算寫入）已隨 Task 16 移除 — 真訂單改由 stores.ts 的
// syncCartToServer / placeOrder / refreshSubscriptions / refreshPoints 接手
// （見 checkout-api.test.ts），points/pointsLedger/subscriptions/cart 的寫入
// 改成 API 回應驅動的 hydrate，而非本地 CheckoutResult 的加總。
