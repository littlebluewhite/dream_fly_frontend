import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCart, cart, cartCount, subscriptions, points, pointsLedger, applyOrder } from './stores';
import { CATALOG, ME, POINTS_LEDGER, courseToCartItem, passToCartItem } from './data';
import type { CatalogCourse, Ticket } from '$lib/public/adapters';
import type { CheckoutResult } from './checkout';

// The singleton cart / subscriptions persist to localStorage; reset them (and
// storage) between tests. Factory carts made with createCart() don't persist,
// so they're naturally isolated and need no reset.
beforeEach(() => {
  localStorage.clear();
  cart.clear();
  cart.waitlist.set([]);
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
const TICKET: Ticket = {
  id: 'product-uuid-1',
  name: '單堂體驗課',
  price: 500,
  desc: '首次體驗任一課程',
  features: []
};

describe('cart waitlist guard (member-catalog course path — cart.add)', () => {
  // cart.add() still serves the not-yet-migrated member surface (numeric
  // CatalogCourse ids from $lib/domain/member-app); it normalises the id to
  // the cart's uuid-string CartItem shape internally.
  const full = { ...CATALOG[0], spots: 0 };

  it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
    const c = createCart();
    const r = c.add(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0); // never enters the paid cart
    expect(get(c.waitlist)).toContain(String(full.id)); // registered for waitlist as a string id
  });

  it('adds a course that still has spots to the paid cart and returns "added"', () => {
    const c = createCart();
    const normal = { ...CATALOG[0], spots: 3 };
    const r = c.add(normal);
    expect(r).toBe('added');
    expect(get(c)).toHaveLength(1);
    expect(get(c.waitlist)).toHaveLength(0);
  });

  it('keeps the waitlist idempotent when the same full course is added twice', () => {
    const c = createCart();
    c.add(full);
    c.add(full);
    expect(get(c.waitlist)).toEqual([String(full.id)]); // recorded once
    expect(get(c)).toHaveLength(0); // still never in the paid cart
  });

  it('bumps (not waitlist) when a course with spots is added twice — qty stays 1 (enrolment, not a quantity)', () => {
    const c = createCart();
    const normal = { ...CATALOG[0], spots: 3 };
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

  it('routes a full public course (spots 0) straight to the waitlist as a uuid string, never the paid cart', () => {
    const c = createCart();
    const full = courseToCartItem({ ...COURSE, spots: 0 });
    const r = c.addItem(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0);
    expect(get(c.waitlist)).toEqual(['course-uuid-1']);
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
  it('round-trips items and waitlist through localStorage under the v3 key for a fresh persisted cart', () => {
    const c1 = createCart(true);
    c1.add({ ...CATALOG[0], spots: 3 }); // normal → cart
    c1.add({ ...CATALOG[1], spots: 0 }); // full → waitlist
    const c2 = createCart(true); // simulate a reload
    expect(get(c2)).toHaveLength(1);
    expect(get(c2.waitlist)).toContain(String(CATALOG[1].id));
    expect(localStorage.getItem('dreamfly_cart_v3')).toBeTruthy();
  });

  it('a non-persisted factory cart leaves localStorage untouched', () => {
    const before = localStorage.getItem('dreamfly_cart_v3');
    const c = createCart(); // persist defaults off
    c.add({ ...CATALOG[0], spots: 3 });
    expect(localStorage.getItem('dreamfly_cart_v3')).toBe(before); // unchanged
  });

  it('never reads the old v2 cart key — a v2 cart from a previous release is left alone, not migrated', () => {
    localStorage.setItem('dreamfly_cart_v2', JSON.stringify({ items: [{ id: 2002, type: 'course', name: 'old', price: 1, qty: 1, icon: 'x' }], waitlist: [] }));
    const c = createCart(true);
    expect(get(c)).toHaveLength(0); // v3 cart starts fresh, ignoring v2 data
    expect(localStorage.getItem('dreamfly_cart_v2')).toBeTruthy(); // v2 data itself is left in place
  });
});

describe('cartCount (badge source)', () => {
  it('sums qty across lines, not the number of lines', () => {
    cart.addItem(courseToCartItem(COURSE)); // qty 1
    cart.updateQty(COURSE.id, 1); // manual stepper bump → qty 2
    cart.addItem(passToCartItem(TICKET)); // qty 1 (locked)
    expect(get(cartCount)).toBe(3); // 2 (course qty) + 1 (pass), though only 2 lines
  });
});

describe('subscriptions (entitlements persist)', () => {
  it('writes entitlements to localStorage so they survive reload', () => {
    subscriptions.set([{ id: 'product-uuid-1', name: '單堂體驗課', since: '2026/06/17', price: 500 }]);
    expect(localStorage.getItem('dreamfly_subscriptions')).toContain('單堂體驗課');
  });
});

describe('applyOrder — 結算寫入 stores', () => {
  // 輔助：建立一個含 earn+redeem 兩筆 ledger 的 CheckoutResult fixture。
  function makeResult(overrides: Partial<CheckoutResult> = {}): CheckoutResult {
    return {
      subtotal: 4500,
      couponOff: 0,
      ptRedeem: 0,
      total: 4500,
      earned: 225,
      hasCourse: false,
      hasPass: true,
      pointDelta: 225,
      ledgerEntries: [
        { date: '2026/06/22', desc: '訂閱回饋點數', type: 'earn', delta: 225 }
      ],
      newSubscriptions: [],
      ...overrides
    };
  }

  it('ledger id 唯一 — earn 以 co-earn- 開頭、redeem 以 co-redeem- 開頭，且兩者互異', () => {
    const result = makeResult({
      pointDelta: 225 - 100,
      ledgerEntries: [
        { date: '2026/06/22', desc: '訂閱回饋點數', type: 'earn', delta: 225 },
        { date: '2026/06/22', desc: '結帳折抵 · 方案訂閱', type: 'redeem', delta: -100 }
      ]
    });
    applyOrder(result);
    const ledger = get(pointsLedger);
    // 新增的兩筆在最前（prepend），index 0 = earn, index 1 = redeem
    const earn = ledger[0];
    const redeem = ledger[1];
    expect(earn.id).toMatch(/^co-earn-/);
    expect(redeem.id).toMatch(/^co-redeem-/);
    expect(earn.id).not.toBe(redeem.id);
  });

  it('ledger 最新在前 — applyOrder 後新筆 prepend 在既有項目之前', () => {
    const existingLen = get(pointsLedger).length;
    expect(existingLen).toBeGreaterThan(0);
    applyOrder(makeResult());
    const ledger = get(pointsLedger);
    // 新增 1 筆 earn，應排在最前面
    expect(ledger).toHaveLength(existingLen + 1);
    expect(ledger[0].id).toMatch(/^co-earn-/);
    // 原第一筆應退到 index 1
    expect(ledger[1].id).toBe(POINTS_LEDGER[0].id);
  });

  it('point delta — 初始 1250 點，applyOrder pointDelta=225 後變 1475', () => {
    expect(get(points)).toBe(1250); // ME.points
    applyOrder(makeResult({ pointDelta: 225 }));
    expect(get(points)).toBe(1475); // 1250 + 225
  });

  it('point delta 可為負 — 折抵大於獲得時，points 正確減少', () => {
    applyOrder(makeResult({ pointDelta: -50 }));
    expect(get(points)).toBe(1200); // 1250 - 50
  });

  it('subscription 去重 — newSubscriptions 內 id 已存在於 subscriptions 時不重複加', () => {
    subscriptions.set([{ id: 'product-uuid-2', name: '競技啦啦隊月費', since: '2026/01/01', price: 4500 }]);
    applyOrder(makeResult({
      newSubscriptions: [{ id: 'product-uuid-2', name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 }]
    }));
    const subs = get(subscriptions);
    expect(subs).toHaveLength(1);
    expect(subs[0].since).toBe('2026/01/01'); // 原有的不被覆蓋
  });

  it('subscription 批次冪等 — newSubscriptions 含相同 id 兩筆，只進一筆', () => {
    applyOrder(makeResult({
      newSubscriptions: [
        { id: 'product-uuid-2', name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 },
        { id: 'product-uuid-2', name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 }
      ]
    }));
    const subs = get(subscriptions);
    expect(subs).toHaveLength(1);
    expect(subs.filter((s) => s.id === 'product-uuid-2')).toHaveLength(1);
  });

  it('cart 在 applyOrder 後清空', () => {
    cart.addItem(passToCartItem(TICKET));
    expect(get(cart)).toHaveLength(1);
    applyOrder(makeResult());
    expect(get(cart)).toHaveLength(0);
  });
});
