import { describe, it, expect } from 'vitest';
import { mobileGuardTarget } from './guard';

describe('mobileGuardTarget — /mobile/* login guard', () => {
  it('lets a logged-in visitor through to any /mobile page', () => {
    expect(mobileGuardTarget('/mobile', true)).toBe(null);
    expect(mobileGuardTarget('/mobile/mine', true)).toBe(null);
  });

  it('redirects a logged-out visitor to the login screen', () => {
    expect(mobileGuardTarget('/mobile', false)).toBe('/mobile/login');
    expect(mobileGuardTarget('/mobile/account', false)).toBe('/mobile/login');
  });

  it('lets a logged-out visitor through to the login page itself (no redirect loop)', () => {
    expect(mobileGuardTarget('/mobile/login', false)).toBe(null);
  });
});
