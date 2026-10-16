import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import Sidebar from './Sidebar.svelte';
import { authStore } from '$lib/stores/authStore';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { apiCalls } from '$lib/testing/admin-routes';
import { resetSessionStores } from '$lib/testing/session-reset';

// Sidebar 讀 $page.url.pathname 判斷 nav active 狀態、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/admin') })
}));

/* authStore 是真的:只替換 api(),經 loginRoutes() 登入名叫王小明的 fixture user,
 * 才能斷言姓名縮寫,不只是測 fallback。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

describe('admin Sidebar — 身分槽位改讀 authStore', () => {
  beforeEach(async () => {
    await resetSessionStores();
    vi.mocked(api).mockImplementation(fakeRouter(loginRoutes(() => ['admin'])));
  });
  afterEach(() => vi.clearAllMocks());

  it('已登入:顯示真名「王小明」與縮寫「王」', async () => {
    await authStore.login('admin@dreamfly.test', 'pw');
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
    await authStore.login('admin@dreamfly.test', 'pw');
    render(Sidebar);

    await fireEvent.click(screen.getByText('王小明').closest('button')!);
    await fireEvent.click(screen.getByRole('menuitem', { name: /登出/ }));

    expect(apiCalls('POST /auth/logout')).toHaveLength(1);
    expect(get(authStore).loggedIn).toBe(false);
    expect(goto).toHaveBeenCalledWith('/staff/login');
  });
});
