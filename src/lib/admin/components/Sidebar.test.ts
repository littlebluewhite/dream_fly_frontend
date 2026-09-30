import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import Sidebar from './Sidebar.svelte';
import { authStore } from '$lib/stores/authStore';
import { FIXTURE_MEMBER, type TestAuthStore } from '$lib/testing/auth-mock';

// Sidebar 讀 $page.url.pathname 判斷 nav active 狀態、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/admin') })
}));

/* authStore 是串真後端的 API-backed store;本檔渲染測試只關心「已登入/未登入」
 * 身分槽位的渲染文字,用一個微型本地 store 頂替——login 塞真的 fixture member
 * 物件(同 coach 側 Sidebar.test.ts 的作法),才能斷言姓名縮寫,不只是測 fallback。 */
vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockB } = await import('$lib/testing/auth-mock');
  return makeAuthMockB();
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

  it('登出:結束 auth 工作階段並導向 /staff/login', async () => {
    (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['admin'] });
    render(Sidebar);

    await fireEvent.click(screen.getByText('王小明').closest('button')!);
    await fireEvent.click(screen.getByRole('menuitem', { name: /登出/ }));

    expect(authStore.logout).toHaveBeenCalled();
    expect(get(authStore).loggedIn).toBe(false);
    expect(goto).toHaveBeenCalledWith('/staff/login');
  });
});
