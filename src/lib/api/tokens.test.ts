import { describe, it, expect, beforeEach } from 'vitest';
import { getAccess, setTokens, getRefresh, clearTokens } from './tokens';

const REFRESH_KEY = 'dreamfly_refresh';

// tokens.ts is a module singleton (access token lives in module memory), so
// reset both the in-memory value and localStorage before each test.
beforeEach(() => {
  clearTokens();
  localStorage.clear();
});

describe('tokens', () => {
  it('starts with no access or refresh token', () => {
    expect(getAccess()).toBe(null);
    expect(getRefresh()).toBe(null);
  });

  it('setTokens stores the access token in memory and the refresh token in localStorage', () => {
    setTokens('access-123', 'refresh-456');

    expect(getAccess()).toBe('access-123');
    expect(getRefresh()).toBe('refresh-456');
    expect(localStorage.getItem(REFRESH_KEY)).toBe('refresh-456');
  });

  it('never writes the access token to localStorage under any key', () => {
    setTokens('super-secret-access-token', 'refresh-456');

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      expect(localStorage.getItem(key)).not.toBe('super-secret-access-token');
    }
  });

  it('clearTokens clears both the in-memory access token and the persisted refresh token', () => {
    setTokens('access-123', 'refresh-456');

    clearTokens();

    expect(getAccess()).toBe(null);
    expect(getRefresh()).toBe(null);
    expect(localStorage.getItem(REFRESH_KEY)).toBe(null);
  });

  it('setTokens overwrites the previous pair (rotation)', () => {
    setTokens('access-1', 'refresh-1');
    setTokens('access-2', 'refresh-2');

    expect(getAccess()).toBe('access-2');
    expect(getRefresh()).toBe('refresh-2');
  });
});
