import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rememberStaffRole, STAFF_ROLE_KEY, ROLE_HOME } from './roles';

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
