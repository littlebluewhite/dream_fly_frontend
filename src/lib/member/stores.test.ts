import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCart, cart, cartCount, subscriptions } from './stores';
import { CATALOG, marketingCourseToCartItem, passToCartItem } from './data';

// The singleton cart / subscriptions persist to localStorage; reset them (and
// storage) between tests. Factory carts made with createCart() don't persist,
// so they're naturally isolated and need no reset.
beforeEach(() => {
  localStorage.clear();
  cart.clear();
  cart.waitlist.set([]);
  subscriptions.set([]);
});

// A full course is any catalog course with no remaining spots.
const full = { ...CATALOG[0], spots: 0 };

describe('cart waitlist guard', () => {
  it('records a full course (spots 0) as waitlisted instead of adding it to the paid cart', () => {
    const c = createCart();
    const r = c.add(full);
    expect(r).toBe('waitlisted');
    expect(get(c)).toHaveLength(0); // never enters the paid cart
    expect(get(c.waitlist)).toContain(full.id); // registered for waitlist
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
    expect(get(c.waitlist)).toEqual([full.id]); // recorded once
    expect(get(c)).toHaveLength(0); // still never in the paid cart
  });

  it('still bumps qty (not waitlist) when a course with spots is added twice', () => {
    const c = createCart();
    const normal = { ...CATALOG[0], spots: 3 };
    expect(c.add(normal)).toBe('added');
    expect(c.add(normal)).toBe('bumped');
    expect(get(c)[0].qty).toBe(2);
  });
});

describe('cart — addItem (adapted marketing courses + passes)', () => {
  it('adds an adapted marketing course under a namespaced id and bumps qty on repeat', () => {
    const c = createCart();
    const mk = marketingCourseToCartItem({
      id: 2, name: '競技啦啦隊', level: '競技', duration: '',
      price: 'NT$ 4,500/月', description: '', includes: []
    });
    expect(c.addItem(mk)).toBe('added');
    expect(c.addItem(mk)).toBe('bumped');
    expect(get(c)[0].id).toBe(2002); // namespaced — won't collide with member course id 2
    expect(get(c)[0].qty).toBe(2);
  });

  it('locks a pass to qty 1 — a second add is recognised but never increments', () => {
    const c = createCart();
    const pass = passToCartItem({
      id: 3, name: '競技啦啦隊月費', price: 'NT$ 4,500',
      duration: '每月8堂', description: '', features: []
    });
    expect(c.addItem(pass)).toBe('added');
    expect(c.addItem(pass)).toBe('bumped');
    expect(get(c)).toHaveLength(1);
    expect(get(c)[0].qty).toBe(1); // single entitlement — no qty > 1
  });
});

describe('cart persistence (survives login / reload)', () => {
  it('round-trips items and waitlist through localStorage for a fresh persisted cart', () => {
    const c1 = createCart(true);
    c1.add({ ...CATALOG[0], spots: 3 }); // normal → cart
    c1.add({ ...CATALOG[1], spots: 0 }); // full → waitlist
    const c2 = createCart(true); // simulate a reload
    expect(get(c2)).toHaveLength(1);
    expect(get(c2.waitlist)).toContain(CATALOG[1].id);
  });

  it('a non-persisted factory cart leaves localStorage untouched', () => {
    const before = localStorage.getItem('dreamfly_cart_v2');
    const c = createCart(); // persist defaults off
    c.add({ ...CATALOG[0], spots: 3 });
    expect(localStorage.getItem('dreamfly_cart_v2')).toBe(before); // unchanged
  });
});

describe('cartCount (badge source)', () => {
  it('sums qty across lines, not the number of lines', () => {
    cart.add({ ...CATALOG[0], spots: 5 });
    cart.add({ ...CATALOG[0], spots: 5 }); // same id → qty 2, one line
    cart.addItem(
      passToCartItem({ id: 1, name: '單堂體驗課', price: 'NT$ 500', duration: '單次', description: '', features: [] })
    );
    expect(get(cartCount)).toBe(3); // 2 (course qty) + 1 (pass), though only 2 lines
  });
});

describe('subscriptions (entitlements persist)', () => {
  it('writes entitlements to localStorage so they survive reload', () => {
    subscriptions.set([{ id: 1001, name: '單堂體驗課', since: '2026/06/17', price: 500 }]);
    expect(localStorage.getItem('dreamfly_subscriptions')).toContain('單堂體驗課');
  });
});
