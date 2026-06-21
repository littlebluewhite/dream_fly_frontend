/* Dream Fly — 純 commitCheckout 結算函式單測（TDD）
 *
 * 每段行為單獨一個 describe，依序釘住：
 *  1. 金額拆解正確
 *  2. pointDelta = earned − ptRedeem
 *  3. ledger 零值守衛（4 cases）
 *  4. 去重：same pass 兩 line → 恰一筆；已在 ownedSubs → 0 筆
 *  5. since 與 ledger date 都等於 ctx.today
 *  6. hasCourse / hasPass facts（純課程、純方案、混合）
 */

import { describe, it, expect } from 'vitest';
import { commitCheckout, chargeableLines } from './checkout';
import type { CartItem, CheckoutContext } from './checkout';

/* ─── 輔助 builders ─────────────────────────────────────────────── */
function makeCourse(id: number, price: number, qty = 1): CartItem {
  return { id, type: 'course', name: `課程 ${id}`, price, qty, icon: 'sparkles' };
}
function makePass(id: number, price: number, qty = 1): CartItem {
  return { id, type: 'pass', name: `方案 ${id}`, price, qty, icon: 'ticket' };
}
function ctx(overrides: Partial<CheckoutContext> = {}): CheckoutContext {
  return {
    points: 0,
    usePoints: false,
    coupon: null,
    ownedSubs: [],
    today: '2026/06/22',
    ...overrides
  };
}

/* ─── 1. 金額拆解 ──────────────────────────────────────────────── */
describe('commitCheckout — 金額拆解', () => {
  it('一張課程 line，無折扣無點數：subtotal/couponOff/ptRedeem/total/earned 正確', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx());
    expect(result.subtotal).toBe(4800);
    expect(result.couponOff).toBe(0);
    expect(result.ptRedeem).toBe(0);
    expect(result.total).toBe(4800);
    expect(result.earned).toBe(Math.round(4800 * 0.05)); // 240
  });

  it('優惠碼折抵 100：couponOff=100, total=4700, earned=Math.round(4700×0.05)', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ coupon: { off: 100 } }));
    expect(result.couponOff).toBe(100);
    expect(result.total).toBe(4700);
    expect(result.earned).toBe(Math.round(4700 * 0.05));
  });

  it('usePoints=true 且 points=200：ptRedeem=200, total 夾擠', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ points: 200, usePoints: true }));
    expect(result.ptRedeem).toBe(200);
    expect(result.total).toBe(4600);
  });
});

/* ─── 2. pointDelta ────────────────────────────────────────────── */
describe('commitCheckout — pointDelta', () => {
  it('pointDelta = earned − ptRedeem', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ points: 200, usePoints: true }));
    expect(result.pointDelta).toBe(result.earned - result.ptRedeem);
  });
});

/* ─── 3. ledger 零值守衛 ───────────────────────────────────────── */
describe('commitCheckout — ledger 零值守衛', () => {
  it('(a) usePoints=false → 無 redeem 筆', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ points: 500, usePoints: false }));
    expect(result.ledgerEntries.some((e) => e.type === 'redeem')).toBe(false);
  });

  it('(b) 折扣+折抵讓 earned===0 → 無 earn 筆（優惠碼 = subtotal → total=0）', () => {
    // subtotal=100, couponOff=100, total=0, earned=0
    const cart: CartItem[] = [makeCourse(1, 100)];
    const result = commitCheckout(cart, ctx({ coupon: { off: 100 } }));
    expect(result.earned).toBe(0);
    expect(result.ledgerEntries.some((e) => e.type === 'earn')).toBe(false);
  });

  it('(c) cart 全是 ownedSubs 的 pass → ledgerEntries 空、newSubscriptions 空、total 0', () => {
    const cart: CartItem[] = [makePass(1001, 3000)];
    const result = commitCheckout(cart, ctx({ ownedSubs: [{ id: 1001 }] }));
    expect(result.ledgerEntries).toHaveLength(0);
    expect(result.newSubscriptions).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('(d) earned>0 且 ptRedeem>0 → 恰 [earn,redeem]、順序正確、delta 正負正確、desc 分支課程', () => {
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ points: 200, usePoints: true }));
    expect(result.earned).toBeGreaterThan(0);
    expect(result.ptRedeem).toBeGreaterThan(0);
    expect(result.ledgerEntries).toHaveLength(2);
    const [earn, redeem] = result.ledgerEntries;
    expect(earn.type).toBe('earn');
    expect(earn.delta).toBe(result.earned);
    expect(earn.desc).toBe('報名回饋點數');
    expect(redeem.type).toBe('redeem');
    expect(redeem.delta).toBe(-result.ptRedeem);
    expect(redeem.desc).toBe('結帳折抵 · 課程報名');
  });
});

/* ─── 4. 去重 ─────────────────────────────────────────────────── */
describe('commitCheckout — 去重', () => {
  it('同一 pass 在 cart 出現兩 line → 恰一筆 Subscription', () => {
    // qty 代表購買件數，id 相同算同一張方案
    const cart: CartItem[] = [makePass(1001, 3000), makePass(1001, 3000)];
    // 注意：id 相同時購物車通常不允許兩筆，但 pure fn 必須容錯去重
    const result = commitCheckout(cart, ctx());
    expect(result.newSubscriptions.filter((s) => s.id === 1001)).toHaveLength(1);
  });

  it('pass 已在 ownedSubs → 0 筆新訂閱', () => {
    const cart: CartItem[] = [makePass(1001, 3000)];
    const result = commitCheckout(cart, ctx({ ownedSubs: [{ id: 1001 }] }));
    expect(result.newSubscriptions).toHaveLength(0);
  });
});

/* ─── 5. since 與 ledger date 單一時鐘來源 ─────────────────────── */
describe('commitCheckout — 單一時鐘來源 ctx.today', () => {
  it('每筆 ledger date 都等於 ctx.today', () => {
    const today = '2026/06/22';
    const cart: CartItem[] = [makeCourse(1, 4800)];
    const result = commitCheckout(cart, ctx({ points: 100, usePoints: true, today }));
    for (const entry of result.ledgerEntries) {
      expect(entry.date).toBe(today);
    }
  });

  it('newSubscriptions 的 since 都等於 ctx.today', () => {
    const today = '2026/06/22';
    const cart: CartItem[] = [makePass(1001, 3000)];
    const result = commitCheckout(cart, ctx({ today }));
    expect(result.newSubscriptions[0].since).toBe(today);
  });
});

/* ─── 6. hasCourse / hasPass facts ────────────────────────────── */
describe('commitCheckout — hasCourse / hasPass', () => {
  it('純課程 → hasCourse=true, hasPass=false', () => {
    const result = commitCheckout([makeCourse(1, 4800)], ctx());
    expect(result.hasCourse).toBe(true);
    expect(result.hasPass).toBe(false);
  });

  it('純方案（未持有）→ hasCourse=false, hasPass=true', () => {
    const result = commitCheckout([makePass(1001, 3000)], ctx());
    expect(result.hasCourse).toBe(false);
    expect(result.hasPass).toBe(true);
  });

  it('混合（課程 + 方案）→ hasCourse=true, hasPass=true', () => {
    const result = commitCheckout([makeCourse(1, 4800), makePass(1001, 3000)], ctx());
    expect(result.hasCourse).toBe(true);
    expect(result.hasPass).toBe(true);
  });

  it('訂閱回饋點數 desc 分支：純方案 earned>0 → earn desc = 訂閱回饋點數', () => {
    // 純方案，earned>0（price=3000, total=3000, earned=150）
    const result = commitCheckout([makePass(1001, 3000)], ctx());
    const earn = result.ledgerEntries.find((e) => e.type === 'earn');
    expect(earn?.desc).toBe('訂閱回饋點數');
  });
});

/* ─── chargeableLines ─────────────────────────────────────────── */
describe('chargeableLines', () => {
  it('過濾掉已持有的 pass，保留課程與未持有 pass', () => {
    const cart: CartItem[] = [makeCourse(1, 4800), makePass(1001, 3000), makePass(1002, 2000)];
    const result = chargeableLines(cart, [{ id: 1001 }]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual([1, 1002]);
  });
});
