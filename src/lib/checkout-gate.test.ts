import { describe, it, expect } from 'vitest';
import { checkoutTarget, wantsCheckout } from './checkout-gate';

describe('checkoutTarget — auth-at-checkout routing', () => {
  it('sends a logged-in member straight to the member checkout', () => {
    expect(checkoutTarget(true)).toBe('/member?checkout=1');
  });

  it('sends a guest to login carrying a redirect back to checkout', () => {
    expect(checkoutTarget(false)).toBe(
      '/member/login?redirect=' + encodeURIComponent('/member?checkout=1')
    );
  });
});

describe('wantsCheckout — the receiving half of the gate', () => {
  it('is true when ?checkout=1 is present', () => {
    expect(wantsCheckout(new URL('https://x.test/member?checkout=1'))).toBe(true);
  });

  it('is false on a plain member URL', () => {
    expect(wantsCheckout(new URL('https://x.test/member'))).toBe(false);
  });
});
