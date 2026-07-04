import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  rememberStaffRole,
  STAFF_ROLE_KEY,
  ROLE_HOME,
  staffPortals,
  staffGuardTarget,
  wantsBlockedNotice
} from './roles';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('STAFF_ROLE_KEY', () => {
  it('matches the key /staff/login persists, so the last-role handshake holds', () => {
    expect(STAFF_ROLE_KEY).toBe('df_staff_last_role');
  });
});

describe('ROLE_HOME', () => {
  it('routes each staff role to its landing surface', () => {
    expect(ROLE_HOME.admin).toBe('/admin');
    expect(ROLE_HOME.coach).toBe('/coach');
  });
});

describe('rememberStaffRole', () => {
  it('persists the chosen role so it can be read back', () => {
    rememberStaffRole('coach');
    expect(localStorage.getItem(STAFF_ROLE_KEY)).toBe('coach');
  });

  it('swallows storage failures (SSR / quota) instead of propagating', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => rememberStaffRole('admin')).not.toThrow();
  });
});

describe('staffPortals', () => {
  it('admin role → can enter both admin and coach, admin first', () => {
    expect(staffPortals(['admin'])).toEqual(['admin', 'coach']);
  });

  it('coach-only role → coach portal only', () => {
    expect(staffPortals(['coach'])).toEqual(['coach']);
  });

  it('member-only role → no staff portal', () => {
    expect(staffPortals(['member'])).toEqual([]);
  });

  it('combined admin+coach roles → same as admin alone', () => {
    expect(staffPortals(['admin', 'coach'])).toEqual(['admin', 'coach']);
  });

  it('no roles at all → no staff portal', () => {
    expect(staffPortals([])).toEqual([]);
  });
});

describe('staffGuardTarget', () => {
  it('not logged in → redirects to /staff/login regardless of role', () => {
    expect(staffGuardTarget('admin', false, [])).toBe('/staff/login');
    expect(staffGuardTarget('coach', false, ['admin'])).toBe('/staff/login');
  });

  it('logged in but missing the portal role → blocked redirect', () => {
    expect(staffGuardTarget('admin', true, ['coach'])).toBe('/staff/login?blocked=1');
    expect(staffGuardTarget('admin', true, ['member'])).toBe('/staff/login?blocked=1');
    expect(staffGuardTarget('admin', true, [])).toBe('/staff/login?blocked=1');
    expect(staffGuardTarget('coach', true, [])).toBe('/staff/login?blocked=1');
  });

  it('logged in with the right role → passes (no redirect)', () => {
    expect(staffGuardTarget('admin', true, ['admin'])).toBeNull();
    expect(staffGuardTarget('coach', true, ['coach'])).toBeNull();
    expect(staffGuardTarget('coach', true, ['admin'])).toBeNull(); // admin can also enter coach
  });
});

describe('wantsBlockedNotice', () => {
  it('true when the URL carries ?blocked=1', () => {
    expect(wantsBlockedNotice(new URL('http://localhost/staff/login?blocked=1'))).toBe(true);
  });

  it('false without the marker', () => {
    expect(wantsBlockedNotice(new URL('http://localhost/staff/login'))).toBe(false);
  });
});
