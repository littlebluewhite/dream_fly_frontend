import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import { readable, get } from 'svelte/store';
import { goto } from '$app/navigation';
import Sidebar from './Sidebar.svelte';
import { authStore } from '$lib/stores/authStore';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { apiCalls } from '$lib/testing/admin-routes';
import { resetSessionStores } from '$lib/testing/session-reset';
import { conversationSummary } from '$lib/testing/wire-fixtures';
import { hydrateConversations } from '$lib/coach/conversations';

// Sidebar 讀 $page.url.pathname 判斷 nav active 狀態、點擊呼叫 goto()。
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/coach') })
}));

/* authStore 是真的:經 loginRoutes() 登入名叫王小明的 fixture user,驗證真姓名衍生出的
 * 「王教練」「王小明 教練」等文字。角標讀教練對話列表(閘門隨 beforeEach 的身分重置歸零):
 * 只替換 api(),經 hydrateConversations 灌入列表。 */
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

type Routes = Record<string, unknown>;
let routes: Routes;
const route = (extra: Routes) => (routes = { ...routes, ...extra });
const loginCoach = () => authStore.login('coach@dreamfly.test', 'pw');

beforeEach(async () => {
  await resetSessionStores();
  routes = loginRoutes(() => ['coach']);
  vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
});
afterEach(() => vi.clearAllMocks());

describe('coach Sidebar — 身分槽位改讀 authStore', () => {
  it('已登入:profile card 顯示「王教練」與角色字面「教練」', async () => {
    await loginCoach();
    render(Sidebar);

    expect(screen.getByText('王教練')).toBeInTheDocument();
    expect(screen.getByText('教練')).toBeInTheDocument();
  });

  it('已登入:點開 popover 顯示「王小明 教練」,不再殘留舊假員編', async () => {
    await loginCoach();
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

  it('登出:結束 auth 工作階段並導向 /staff/login', async () => {
    await loginCoach();
    render(Sidebar);

    await fireEvent.click(screen.getByText('王教練').closest('button')!);
    await fireEvent.click(screen.getByText('登出目前工作階段').closest('button')!);

    expect(apiCalls('POST /auth/logout')).toHaveLength(1);
    expect(get(authStore).loggedIn).toBe(false);
    expect(goto).toHaveBeenCalledWith('/staff/login');
  });
});

describe('coach Sidebar — 訊息中心角標讀未讀對話數(R20)', () => {
  const messagesBtn = () => screen.getByText('訊息中心').closest('button')!;

  it('有未讀:顯示「badge > 0 的對話數」而非未讀則數加總', async () => {
    route({
      'GET /conversations/me': [
        conversationSummary({ id: 'c1', unread_count: 5 }),
        conversationSummary({ id: 'c2', unread_count: 1 }),
        conversationSummary({ id: 'c3', unread_count: 0 })
      ]
    });
    await loginCoach();
    render(Sidebar);
    await hydrateConversations();
    await tick();

    expect(messagesBtn()).toHaveTextContent('訊息中心');
    expect(messagesBtn().textContent!.replace(/\s+/g, '')).toBe('訊息中心2');
  });

  it('未讀為 0:不顯示角標', async () => {
    route({ 'GET /conversations/me': [conversationSummary({ id: 'c1', unread_count: 0 })] });
    await loginCoach();
    render(Sidebar);
    await hydrateConversations();
    await tick();

    expect(messagesBtn().textContent!.replace(/\s+/g, '')).toBe('訊息中心');
  });

  it('其他導覽項沒有角標', () => {
    render(Sidebar);
    expect(screen.getByText('儀表板').closest('button')!.textContent!.trim()).toBe('儀表板');
  });
});
