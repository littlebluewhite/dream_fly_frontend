/* Dream Fly — 純 commitCheckout 結算函式單測（TDD）
 *
 * 每段行為單獨一個 describe，依序釘住：
 *  1. 金額拆解正確
 *  2. pointDelta = earned − ptRedeem
 *  3. ledger 零值守衛（4 cases）
 *  4. 去重：same pass 兩 line → 恰一筆；已在 ownedSubs → 0 筆
 *  5. since 與 ledger date 都等於 ctx.today
 *  6. hasCourse / hasPass facts（純課程、純方案、混合）
 *
 * cart v3：CartItem.id / Subscription.id 改為 uuid string（型別層流通，語意不變 —
 * 這裡的 id 只是字串字面量，不代表真的 uuid 格式）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commitCheckout, chargeableLines, validateCoupon, orderErrorMessage } from './checkout';
import type { CartItem, CheckoutContext } from './checkout';
import { api, ApiError } from '$lib/api/client';

// 只替換 api()，ApiError 用回真實類別（validateCoupon 靠 instanceof 判斷 404）。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/* ─── 輔助 builders ─────────────────────────────────────────────── */
function makeCourse(id: string, price: number, qty = 1): CartItem {
  return { id, type: 'course', name: `課程 ${id}`, price, qty, icon: 'sparkles' };
}
function makePass(id: string, price: number, qty = 1): CartItem {
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
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx());
    expect(result.subtotal).toBe(4800);
    expect(result.couponOff).toBe(0);
    expect(result.ptRedeem).toBe(0);
    expect(result.total).toBe(4800);
    expect(result.earned).toBe(Math.round(4800 * 0.05)); // 240
  });

  it('優惠碼折抵 100：couponOff=100, total=4700, earned=Math.round(4700×0.05)', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ coupon: { off: 100 } }));
    expect(result.couponOff).toBe(100);
    expect(result.total).toBe(4700);
    expect(result.earned).toBe(Math.round(4700 * 0.05));
  });

  it('usePoints=true 且 points=200：ptRedeem=200, total 夾擠', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ points: 200, usePoints: true }));
    expect(result.ptRedeem).toBe(200);
    expect(result.total).toBe(4600);
  });
});

/* ─── 2. pointDelta ────────────────────────────────────────────── */
describe('commitCheckout — pointDelta', () => {
  it('pointDelta = earned − ptRedeem', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ points: 200, usePoints: true }));
    expect(result.pointDelta).toBe(result.earned - result.ptRedeem);
  });
});

/* ─── 3. ledger 零值守衛 ───────────────────────────────────────── */
describe('commitCheckout — ledger 零值守衛', () => {
  it('(a) usePoints=false → 無 redeem 筆', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ points: 500, usePoints: false }));
    expect(result.ledgerEntries.some((e) => e.type === 'redeem')).toBe(false);
  });

  it('(b) 折扣+折抵讓 earned===0 → 無 earn 筆（優惠碼 = subtotal → total=0）', () => {
    // subtotal=100, couponOff=100, total=0, earned=0
    const cart: CartItem[] = [makeCourse('1', 100)];
    const result = commitCheckout(cart, ctx({ coupon: { off: 100 } }));
    expect(result.earned).toBe(0);
    expect(result.ledgerEntries.some((e) => e.type === 'earn')).toBe(false);
  });

  it('(c) cart 全是 ownedSubs 的 pass → ledgerEntries 空、newSubscriptions 空、total 0', () => {
    const cart: CartItem[] = [makePass('1001', 3000)];
    const result = commitCheckout(cart, ctx({ ownedSubs: [{ id: '1001' }] }));
    expect(result.ledgerEntries).toHaveLength(0);
    expect(result.newSubscriptions).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('(d) earned>0 且 ptRedeem>0 → 恰 [earn,redeem]、順序正確、delta 正負正確、desc 分支課程', () => {
    const cart: CartItem[] = [makeCourse('1', 4800)];
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
    const cart: CartItem[] = [makePass('1001', 3000), makePass('1001', 3000)];
    // 注意：id 相同時購物車通常不允許兩筆，但 pure fn 必須容錯去重
    const result = commitCheckout(cart, ctx());
    expect(result.newSubscriptions.filter((s) => s.id === '1001')).toHaveLength(1);
  });

  it('pass 已在 ownedSubs → 0 筆新訂閱', () => {
    const cart: CartItem[] = [makePass('1001', 3000)];
    const result = commitCheckout(cart, ctx({ ownedSubs: [{ id: '1001' }] }));
    expect(result.newSubscriptions).toHaveLength(0);
  });
});

/* ─── 5. since 與 ledger date 單一時鐘來源 ─────────────────────── */
describe('commitCheckout — 單一時鐘來源 ctx.today', () => {
  it('每筆 ledger date 都等於 ctx.today', () => {
    const today = '2026/06/22';
    const cart: CartItem[] = [makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ points: 100, usePoints: true, today }));
    for (const entry of result.ledgerEntries) {
      expect(entry.date).toBe(today);
    }
  });

  it('newSubscriptions 的 since 都等於 ctx.today', () => {
    const today = '2026/06/22';
    const cart: CartItem[] = [makePass('1001', 3000)];
    const result = commitCheckout(cart, ctx({ today }));
    expect(result.newSubscriptions[0].since).toBe(today);
  });
});

/* ─── 6. hasCourse / hasPass facts ────────────────────────────── */
describe('commitCheckout — hasCourse / hasPass', () => {
  it('純課程 → hasCourse=true, hasPass=false', () => {
    const result = commitCheckout([makeCourse('1', 4800)], ctx());
    expect(result.hasCourse).toBe(true);
    expect(result.hasPass).toBe(false);
  });

  it('純方案（未持有）→ hasCourse=false, hasPass=true', () => {
    const result = commitCheckout([makePass('1001', 3000)], ctx());
    expect(result.hasCourse).toBe(false);
    expect(result.hasPass).toBe(true);
  });

  it('混合（課程 + 方案）→ hasCourse=true, hasPass=true', () => {
    const result = commitCheckout([makeCourse('1', 4800), makePass('1001', 3000)], ctx());
    expect(result.hasCourse).toBe(true);
    expect(result.hasPass).toBe(true);
  });

  it('訂閱回饋點數 desc 分支：純方案 earned>0 → earn desc = 訂閱回饋點數', () => {
    // 純方案，earned>0（price=3000, total=3000, earned=150）
    const result = commitCheckout([makePass('1001', 3000)], ctx());
    const earn = result.ledgerEntries.find((e) => e.type === 'earn');
    expect(earn?.desc).toBe('訂閱回饋點數');
  });
});

/* ─── chargeableLines ─────────────────────────────────────────── */
describe('chargeableLines', () => {
  it('過濾掉已持有的 pass，保留課程與未持有 pass', () => {
    const cart: CartItem[] = [makeCourse('1', 4800), makePass('1001', 3000), makePass('1002', 2000)];
    const result = chargeableLines(cart, [{ id: '1001' }]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['1', '1002']);
  });

  it('已持有 pass + 新課程 → 只計課程費用與回饋點（5%×4800=240），pass 視為 no-op', () => {
    // 混合車：id 1001 pass 已持有 → 被過濾；課程 id 1 price 4800 照計。
    const cart: CartItem[] = [makePass('1001', 3000), makeCourse('1', 4800)];
    const result = commitCheckout(cart, ctx({ ownedSubs: [{ id: '1001' }] }));
    expect(result.subtotal).toBe(4800);           // 只算課程
    expect(result.earned).toBe(240);               // 5% × 4800
    expect(result.newSubscriptions).toHaveLength(0); // pass 已持有，不再加訂閱
    expect(result.hasCourse).toBe(true);
    expect(result.hasPass).toBe(false);            // 已持有的 pass 被排除後無 pass 行
  });
});

/* ─── validateCoupon（真實 API 版，取代 checkout-math 的 lookupCoupon 查表）─── */
describe('validateCoupon', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it('有效碼 → 呼叫 GET /coupons/{code}/validate（trim 過），discount_cents 換算 NT$', async () => {
    vi.mocked(api).mockResolvedValue({ code: 'DREAMFLY100', discount_cents: 10000 });

    const result = await validateCoupon('  dreamfly100  ');

    expect(api).toHaveBeenCalledWith('/coupons/dreamfly100/validate');
    expect(result).toEqual({ code: 'DREAMFLY100', off: 100 });
  });

  it('404（不存在／未啟用／已過期）→ null', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(404, 'coupon not found'));

    const result = await validateCoupon('NOPE');

    expect(result).toBeNull();
  });

  it('非 404 錯誤（如網路失敗、5xx）原樣拋出，不吞成 null', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError(500, 'internal error'));

    await expect(validateCoupon('X')).rejects.toBeInstanceOf(ApiError);
  });
});

/* ─── orderErrorMessage（後端結帳錯誤 → 繁中 toast 文案）────────── */
describe('orderErrorMessage', () => {
  // 後端錯誤字串逐字對照 orders/enrolments/points service 原始碼
  // 與 integration-contract.md §3.10 的錯誤清單。
  it.each([
    ['cart is empty', '購物車是空的，請先加入商品'],
    ['invalid coupon', '優惠碼無效，請確認後再試'],
    ['course is full', '課程已額滿，請改選候補或其他班別'],
    ['already enrolled', '你已經報名過這堂課程了'],
    ['insufficient points', '點數不足，請取消使用點數折抵'],
    ['insufficient stock for product 單堂體驗課', '商品庫存不足，請減少數量或移除該項目'],
    ['duplicate checkout', '訂單處理中，請稍候再試']
  ])('後端 "%s" → 對應繁中文案', (backendMessage, expected) => {
    expect(orderErrorMessage(new ApiError(400, backendMessage))).toBe(expected);
  });

  it('未知的 ApiError 訊息 → 通用 fallback', () => {
    expect(orderErrorMessage(new ApiError(500, 'internal error'))).toBe('結帳失敗，請稍後再試');
  });

  it('非 ApiError（如 fetch 網路層 TypeError）→ 通用 fallback', () => {
    expect(orderErrorMessage(new Error('fetch failed'))).toBe('結帳失敗，請稍後再試');
  });
});
