import { describe, it, expect } from 'vitest';
import { lookupCoupon } from './coupons';

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
