import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import Sidebar, { isActive } from './Sidebar.svelte';
import { authStore } from '$lib/stores/authStore';

// Sidebar 讀 $page.url.pathname 判斷 nav active 狀態、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/admin') })
}));

/* authStore 是串真後端的 API-backed store;本檔渲染測試只關心「已登入/未登入」
 * 身分槽位的渲染文字,用一個微型本地 store 頂替——login 塞真的 fixture member
 * 物件(同 coach 側 Sidebar.test.ts 的作法),才能斷言姓名縮寫,不只是測 fallback。 */
type MockMember = {
  id: string;
  name: string;
  initial: string;
  since: string;
  points: number;
  color: string;
  age: number;
};
type MockAuthState = { loggedIn: boolean; member: MockMember | null; roles: string[] };

vi.mock('$lib/stores/authStore', async () => {
  const { writable } = await import('svelte/store');
  const state = writable<MockAuthState>({ loggedIn: false, member: null, roles: [] });
  return {
    authStore: { subscribe: state.subscribe, __set: state.set }
  };
});

type TestAuthStore = typeof authStore & { __set: (s: MockAuthState) => void };

const FIXTURE_MEMBER: MockMember = {
  id: 'u1',
  name: '王小明',
  initial: '王',
  since: '2024-01-01',
  points: 0,
  color: 'var(--df-primary)',
  age: 0
};

/* The active-state rule is the one piece of real branching in the sidebar, so
 * it is extracted as a pure function and unit-tested directly — no $page mock
 * needed. The dashboard (/admin) must be active ONLY on the exact root path,
 * or it would light up on every nested admin route. */
describe('admin Sidebar isActive', () => {
  it('dashboard (/admin) is active only on the exact root path', () => {
    expect(isActive('/admin', '/admin')).toBe(true);
  });

  it('dashboard (/admin) is NOT active on a deeper admin route', () => {
    expect(isActive('/admin', '/admin/members')).toBe(false);
    expect(isActive('/admin', '/admin/settings')).toBe(false);
  });

  it('a module item is active on its own exact path', () => {
    expect(isActive('/admin/members', '/admin/members')).toBe(true);
  });

  it('a module item is active on a nested child path (prefix match)', () => {
    expect(isActive('/admin/members', '/admin/members/42')).toBe(true);
  });

  it('a module item is NOT active on a sibling module', () => {
    expect(isActive('/admin/members', '/admin/coaches')).toBe(false);
    expect(isActive('/admin/orders', '/admin')).toBe(false);
  });
});

describe('admin Sidebar — 身分槽位改讀 authStore', () => {
  beforeEach(() => {
    (authStore as TestAuthStore).__set({ loggedIn: false, member: null, roles: [] });
  });
  afterEach(() => vi.clearAllMocks());

  it('已登入:顯示真名「王小明」與縮寫「王」', () => {
    (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['admin'] });
    render(Sidebar);

    expect(screen.getByText('王小明')).toBeInTheDocument();
    expect(screen.getByText('王')).toBeInTheDocument();
  });

  it('未登入:fallback 顯示「管理員」與縮寫「?」', () => {
    render(Sidebar);

    expect(screen.getByText('管理員')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
