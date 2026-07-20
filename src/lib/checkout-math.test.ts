import { describe, it, expect } from 'vitest';
import { subtotalOf, checkoutMath } from './checkout-math';
import type { ChargeableLine } from './cart-item';

// checkoutMath 現在只收 ChargeableLine[]（可計費約束 brand，見 cart-item）。這裡的
// 數學 fixture 只有 price/qty（不是真實購物車項），經這個檔內 helper 打上 brand 供
// 編譯——production 端唯一的 brand 產地是 chargeableLines()（member/checkout），測試
// 只驗 math、故用檔內 cast fabricate。subtotalOf 仍收較寬的 CartMathLine[]，不需包裝。
function chargeable(lines: { price: number; qty: number }[]): ChargeableLine[] {
  return lines as unknown as ChargeableLine[];
}

describe('subtotalOf', () => {
  it('sums price × qty across lines', () => {
    expect(subtotalOf([{ price: 4800, qty: 1 }, { price: 3200, qty: 2 }])).toBe(11200);
    expect(subtotalOf([])).toBe(0);
  });
});

describe('checkoutMath', () => {
  const items = chargeable([{ price: 4800, qty: 1 }]); // subtotal 4800

  it('no coupon, no points: total = subtotal, earned = 5%', () => {
    expect(checkoutMath(items, null, 1250, false)).toEqual({
      subtotal: 4800,
      couponOff: 0,
      ptRedeem: 0,
      total: 4800,
      earned: 240
    });
  });

  it('applies a coupon discount before points', () => {
    const r = checkoutMath(items, { off: 100 }, 1250, false);
    expect(r.couponOff).toBe(100);
    expect(r.total).toBe(4700);
    expect(r.earned).toBe(235);
  });

  it('caps the coupon at the subtotal (never goes negative)', () => {
    const r = checkoutMath(chargeable([{ price: 50, qty: 1 }]), { off: 500 }, 0, false);
    expect(r.couponOff).toBe(50);
    expect(r.total).toBe(0);
    expect(r.earned).toBe(0);
  });

  it('clamps points redeem to available points', () => {
    const r = checkoutMath(items, null, 300, true); // only 300 pts vs 4800 due
    expect(r.ptRedeem).toBe(300);
    expect(r.total).toBe(4500);
  });

  it('clamps points redeem to the after-coupon amount, not below zero', () => {
    // 4800 - 500 coupon = 4300 due; 9999 pts available -> redeem only 4300
    const r = checkoutMath(items, { off: 500 }, 9999, true);
    expect(r.couponOff).toBe(500);
    expect(r.ptRedeem).toBe(4300);
    expect(r.total).toBe(0);
    expect(r.earned).toBe(0);
  });
});

// 可計費約束的編譯期反例（先例:load-gate.test.ts:645-657 的 @ts-expect-error
// it.skip 形）——未打 brand 的裸 CartMathLine[] 不得直接進 checkoutMath;唯一產地
// 是 chargeableLines()（member/checkout）。雙向性由 tsc 保證:若步驟 3 悄悄把
// checkoutMath 放寬回收 CartMathLine[]，下面那行的型別錯誤會消失、@ts-expect-error
// 變成 unused directive → `npm run check` 轉紅。這條只驗型別、不執行（it.skip）。
it.skip('型別:未打 brand 的裸行不得直接進 checkoutMath（可計費約束）', () => {
  const plain = [{ price: 4800, qty: 1 }]; // 合法 CartMathLine[]，但缺 ChargeableLine brand
  // @ts-expect-error 裸 CartMathLine[] 缺 ChargeableLine brand，唯一產地是 chargeableLines()
  checkoutMath(plain, null, 0, false);
});
