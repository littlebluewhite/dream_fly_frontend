import { describe, it, expect } from 'vitest';
import { checkoutTarget, wantsCheckout, safeRedirect } from './checkout-gate';

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

describe('safeRedirect — blocks open redirects after login', () => {
  it('keeps a same-origin root-relative path', () => {
    expect(safeRedirect('/member?checkout=1')).toBe('/member?checkout=1');
  });

  it('rejects a protocol-relative URL (//evil.com)', () => {
    expect(safeRedirect('//evil.com')).toBe('/member');
  });

  it('rejects an absolute http(s) URL', () => {
    expect(safeRedirect('https://evil.com/phish')).toBe('/member');
  });

  it('rejects a backslash-prefixed authority trick', () => {
    expect(safeRedirect('/\\evil.com')).toBe('/member');
  });

  it('falls back to /member for null or empty input', () => {
    expect(safeRedirect(null)).toBe('/member');
    expect(safeRedirect('')).toBe('/member');
  });
});
