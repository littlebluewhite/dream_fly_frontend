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

vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockA, FIXTURE_MEMBER } = await import('$lib/testing/auth-mock');
  return makeAuthMockA({ memberFor: (email) => ({ ...FIXTURE_MEMBER, id: email }) });
});

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { authStore } from '$lib/stores/authStore';
import { subscriptions } from '$lib/member/subscriptions';
import Layout from './+layout.svelte';

const settle = () => new Promise((r) => setTimeout(r, 0));
const subGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/subscriptions/me').length;
const owned = {
  id: 'sub-b', product_id: 'product-uuid-1', product_name: '月票', status: 'active',
  started_at: '2026-06-01T00:00:00Z', expires_at: null, total_sessions: null,
  remaining_sessions: null, price_cents: 180000
};

beforeEach(async () => {
  mockUrl = new URL('http://localhost/');
  authStore.logout();
  await resetSessionStores();
  subscriptions.set([]);
  vi.mocked(api).mockImplementation(
    fakeRouter({
      'GET /subscriptions/me': () => (get(authStore).member?.id === 'b@test.com' ? [owned] : []),
      'GET /notifications': []
    })
  );
});
afterEach(() => vi.clearAllMocks());

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
