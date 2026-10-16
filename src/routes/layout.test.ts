import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';

/* 根 layout 的行銷外殼暖機(R18 W3):訂閱由根 layout 以登入身分為 key 暖一次,
 * 購物車頁與下拉不再各自觸發;app 介面(member/admin/…)自帶 layout,根 layout 不暖。 */

let mockUrl = new URL('http://localhost/');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));
vi.mock('$app/environment', () => ({ browser: true }));

// authStore 是真的:經 loginRoutes() 登入(member.id 就是 email)。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { loginRoutes } from '$lib/testing/auth-fixtures';
import { resetSessionStores } from '$lib/testing/session-reset';
import { authStore } from '$lib/stores/authStore';
import { subscriptions } from '$lib/member/subscriptions';
import { resetAnnouncementsForTests } from '$lib/stores/notificationsStore';
import Layout from './+layout.svelte';

const settle = () => new Promise((r) => setTimeout(r, 0));
const subGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/subscriptions/me').length;
const postGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/posts?per_page=100').length;
const owned = {
  id: 'sub-b', product_id: 'product-uuid-1', product_name: '月票', status: 'active',
  started_at: '2026-06-01T00:00:00Z', expires_at: null, total_sessions: null,
  remaining_sessions: null, price_cents: 180000
};

beforeEach(async () => {
  await resetSessionStores();
  mockUrl = new URL('http://localhost/');
  // 根 layout 掛載時 authStore.hydrate() 經 global fetch 換 refresh token;回 503(後端暫時不可用)時登入狀態不變。
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
  resetAnnouncementsForTests();
  subscriptions.set([]);
  vi.mocked(api).mockImplementation(
    fakeRouter({
      ...loginRoutes(),
      'GET /subscriptions/me': () => (get(authStore).member?.id === 'b@test.com' ? [owned] : []),
      'GET /notifications': [],
      'GET /posts?per_page=100': { posts: [], total: 0, page: 1, per_page: 100 }
    })
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('根 +layout — 訂閱暖機(R18 W3)', () => {
  it('已登入 → 1 次 GET /subscriptions/me', async () => {
    await authStore.login('a@test.com', 'pw');
    render(Layout);
    await settle();
    expect(subGets()).toBe(1);
  });

  it('頁面已開啟後才登入 → 補暖 1 次', async () => {
    render(Layout);
    await settle();
    expect(subGets()).toBe(0);

    await authStore.login('a@test.com', 'pw');
    await settle();
    expect(subGets()).toBe(1);
  });

  it('A 直接換登 B → 抓到 B 的訂閱', async () => {
    await authStore.login('a@test.com', 'pw');
    render(Layout);
    await settle();
    expect(get(subscriptions)).toEqual([]);

    await authStore.login('b@test.com', 'pw');
    await settle();
    expect(subGets()).toBe(2);
    expect(get(subscriptions).map((s) => s.id)).toEqual(['product-uuid-1']);
  });

  it('未登入 → 0 次', async () => {
    render(Layout);
    await settle();
    expect(subGets()).toBe(0);
  });

  it('app 介面(/member)→ 0 次', async () => {
    mockUrl = new URL('http://localhost/member');
    await authStore.login('a@test.com', 'pw');
    render(Layout);
    await settle();
    expect(subGets()).toBe(0);
  });
});

describe('根 +layout — 行銷公告暖機', () => {
  it('行銷頁 → 1 次 GET /posts?per_page=100（不看登入身分）', async () => {
    render(Layout);
    await settle();
    expect(postGets()).toBe(1);
  });

  it('app 介面(/member)→ 0 次', async () => {
    mockUrl = new URL('http://localhost/member');
    render(Layout);
    await settle();
    expect(postGets()).toBe(0);
  });
});
