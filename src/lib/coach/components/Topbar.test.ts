import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { authStore } from '$lib/stores/authStore';
import { FIXTURE_MEMBER, type TestAuthStore } from '$lib/testing/auth-mock';

// Topbar 讀 $page.url.pathname(判斷是否顯示「新增課程」)、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/coach') })
}));

/* authStore mock 同 ./Sidebar.test.ts —— login 需要真的塞入 fixture member 物件,
 * 才能斷言姓名縮寫「王」,不只是測 fallback。 */
vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockB } = await import('$lib/testing/auth-mock');
  return makeAuthMockB();
});

beforeEach(() => {
  (authStore as TestAuthStore).__set({ loggedIn: false, member: null, roles: [] });
});
afterEach(() => vi.clearAllMocks());

/* 鈴鐺(通知選單)用 module-scope 的 read-state 單例,跨測試殘留——本檔不斷言
 * 其內容,只驗證頭像身分槽位;crumb/title 是 required prop,兩處測試都要傳。 */
describe('coach Topbar — 頭像身分槽位改讀 authStore', () => {
  it('已登入:頭像顯示姓名縮寫「王」', () => {
    (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['coach'] });
    render(Topbar, { crumb: '首頁 / 儀表板', title: '教練儀表板' });

    expect(screen.getByText('王')).toBeInTheDocument();
  });

  it('未登入:頭像 fallback 顯示「?」', () => {
    render(Topbar, { crumb: '首頁 / 儀表板', title: '教練儀表板' });

    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
