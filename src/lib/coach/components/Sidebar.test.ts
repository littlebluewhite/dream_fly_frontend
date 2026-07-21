import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import Sidebar from './Sidebar.svelte';
import { authStore } from '$lib/stores/authStore';
import { FIXTURE_MEMBER, type TestAuthStore } from '$lib/testing/auth-mock';

// Sidebar 讀 $page.url.pathname 判斷 nav active 狀態、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/coach') })
}));

/* authStore 是串真後端的 API-backed store;本檔只關心「已登入/未登入」身分槽位
 * 的渲染文字,用一個微型本地 store 頂替——auth 機制本身由
 * src/lib/stores/authStore.test.ts 覆蓋。與 member 側模板(Sidebar.test.ts:19)
 * 不同:那邊 login 只塞 member: null(只測 fallback),本檔要驗證真姓名衍生出的
 * 「王教練」「王小明 教練」等文字,故補一個 __set 供測試直接指定登入態的 fixture
 * member 物件。 */
vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockB } = await import('$lib/testing/auth-mock');
  return makeAuthMockB();
});

beforeEach(() => {
  (authStore as TestAuthStore).__set({ loggedIn: false, member: null, roles: [] });
});
afterEach(() => vi.clearAllMocks());

describe('coach Sidebar — 身分槽位改讀 authStore', () => {
  it('已登入:profile card 顯示「王教練」與角色字面「教練」', () => {
    (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['coach'] });
    render(Sidebar);

    expect(screen.getByText('王教練')).toBeInTheDocument();
    expect(screen.getByText('教練')).toBeInTheDocument();
  });

  it('已登入:點開 popover 顯示「王小明 教練」,不再殘留舊假員編', async () => {
    (authStore as TestAuthStore).__set({ loggedIn: true, member: FIXTURE_MEMBER, roles: ['coach'] });
    render(Sidebar);

    const profileBtn = screen.getByText('王教練').closest('button');
    await fireEvent.click(profileBtn!);

    expect(screen.getByText('王小明 教練')).toBeInTheDocument();
    expect(screen.queryByText('DF-C2019-007')).toBeNull();
  });

  it('未登入:fallback 顯示「教練」與大頭貼縮寫「?」', () => {
    render(Sidebar); // beforeEach 已設定 loggedIn:false, member:null

    expect(screen.getAllByText('教練')).toHaveLength(2); // profile card 顯示名 + 角色字面
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
