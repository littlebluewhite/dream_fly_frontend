import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createCart, cart, cartCount, subscriptions, points, pointsLedger, applyOrder } from './stores';
import { CATALOG, ME, POINTS_LEDGER, marketingCourseToCartItem, passToCartItem } from './data';
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
    const initialLen = get(pointsLedger).length;
    applyOrder(result);
    const ledger = get(pointsLedger);
    // 新增的兩筆在最前（prepend），index 0 = earn, index 1 = redeem
    const earn = ledger[0];
    const redeem = ledger[1];
    expect(earn.id).toMatch(/^co-earn-/);
    expect(redeem.id).toMatch(/^co-redeem-/);
    expect(earn.id).not.toBe(redeem.id);
    // id 後綴等於寫入時的舊 ledger 長度
    expect(earn.id).toBe('co-earn-' + initialLen);
    expect(redeem.id).toBe('co-redeem-' + initialLen);
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
    const initial = get(points); // 1250
    applyOrder(makeResult({ pointDelta: -50 }));
    expect(get(points)).toBe(initial - 50); // 1200
  });

  it('subscription 去重 — newSubscriptions 內 id 已存在於 subscriptions 時不重複加', () => {
    subscriptions.set([{ id: 2003, name: '競技啦啦隊月費', since: '2026/01/01', price: 4500 }]);
    applyOrder(makeResult({
      newSubscriptions: [{ id: 2003, name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 }]
    }));
    const subs = get(subscriptions);
    expect(subs).toHaveLength(1);
    expect(subs[0].since).toBe('2026/01/01'); // 原有的不被覆蓋
  });

  it('subscription 批次冪等 — newSubscriptions 含相同 id 兩筆，只進一筆', () => {
    applyOrder(makeResult({
      newSubscriptions: [
        { id: 2003, name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 },
        { id: 2003, name: '競技啦啦隊月費', since: '2026/06/22', price: 4500 }
      ]
    }));
    const subs = get(subscriptions);
    expect(subs.filter((s) => s.id === 2003)).toHaveLength(1);
  });

  it('cart 在 applyOrder 後清空', () => {
    cart.addItem(passToCartItem({
      id: 3, name: '競技啦啦隊月費', price: 'NT$ 4,500',
      duration: '每月8堂', description: '', features: []
    }));
    expect(get(cart)).toHaveLength(1);
    applyOrder(makeResult());
    expect(get(cart)).toHaveLength(0);
  });
});
