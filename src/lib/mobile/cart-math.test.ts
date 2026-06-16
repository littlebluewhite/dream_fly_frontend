import { describe, it, expect } from 'vitest';
import { lookupCoupon, subtotalOf, checkoutMath } from './cart-math';

describe('lookupCoupon', () => {
  it('returns the NT$ off for a known code (case-insensitive, trimmed)', () => {
    expect(lookupCoupon('  dreamfly100 ')).toEqual({ code: 'DREAMFLY100', off: 100 });
    expect(lookupCoupon('NEWYEAR500')).toEqual({ code: 'NEWYEAR500', off: 500 });
  });
  it('returns null for an unknown or empty code', () => {
    expect(lookupCoupon('NOPE')).toBe(null);
    expect(lookupCoupon('   ')).toBe(null);
  });
});

describe('subtotalOf', () => {
  it('sums price × qty across lines', () => {
    expect(subtotalOf([{ price: 4800, qty: 1 }, { price: 3200, qty: 2 }])).toBe(11200);
    expect(subtotalOf([])).toBe(0);
  });
});

describe('checkoutMath', () => {
  const items = [{ price: 4800, qty: 1 }]; // subtotal 4800

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
    const r = checkoutMath([{ price: 50, qty: 1 }], { off: 500 }, 0, false);
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
