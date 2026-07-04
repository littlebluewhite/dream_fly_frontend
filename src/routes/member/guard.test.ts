import { describe, it, expect } from 'vitest';
import { memberGuardTarget } from './guard';

describe('memberGuardTarget — /member/* login guard', () => {
  it('lets a logged-in visitor through to any /member page', () => {
    expect(memberGuardTarget('/member', true)).toBe(null);
    expect(memberGuardTarget('/member/account', true)).toBe(null);
  });

  it('redirects a logged-out visitor to login with the original path preserved', () => {
    expect(memberGuardTarget('/member', false)).toBe('/member/login?redirect=' + encodeURIComponent('/member'));
    expect(memberGuardTarget('/member/account', false)).toBe(
      '/member/login?redirect=' + encodeURIComponent('/member/account')
    );
  });

  it('lets a logged-out visitor through to each whitelisted pre-auth page', () => {
    expect(memberGuardTarget('/member/login', false)).toBe(null);
    expect(memberGuardTarget('/member/register', false)).toBe(null);
    expect(memberGuardTarget('/member/forgot-password', false)).toBe(null);
    expect(memberGuardTarget('/member/reset-password', false)).toBe(null);
  });
});
