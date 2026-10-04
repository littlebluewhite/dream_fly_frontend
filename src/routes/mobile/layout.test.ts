import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readable, get } from 'svelte/store';
import { tick } from 'svelte';
import { goto } from '$app/navigation';

/* mirrors src/routes/member/layout.test.ts's login-guard describe block —
 * mobile has no checkout-gate receiver to test, just the real auth guard
 * that replaced the demo `df_mobile_session` flag (Task 19). */

let mockUrl = new URL('http://localhost/mobile');
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
  page: readable({ get url() { return mockUrl; } })
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
  const { makeAuthMockA } = await import('$lib/testing/auth-mock');
  const { FIXTURE_MEMBER } = await import('$lib/testing/auth-mock');
  return makeAuthMockA({ memberFor: (email) => ({ ...FIXTURE_MEMBER, id: email }) });
});

// R14(候選 F3)暖機清單:layout 以身分為 key 暖通知——只替換 api(),數 GET /notifications。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { authStore } from '$lib/stores/authStore';
import { overlay } from '$lib/mobile/stores';
import Layout from './+layout.svelte';
import { describePageLifetime } from '$lib/testing/page-lifetime';

beforeEach(async () => {
  mockUrl = new URL('http://localhost/mobile');
  authStore.logout();
  await resetSessionStores();
  vi.mocked(api).mockImplementation(fakeRouter({ 'GET /notifications': [] }));
});
afterEach(() => vi.clearAllMocks());

describe('mobile +layout — real auth guard (Task 19, replaces df_mobile_session)', () => {
  it('a logged-out visitor at /mobile is redirected to /mobile/login', () => {
    render(Layout);
    expect(goto).toHaveBeenCalledWith('/mobile/login');
  });

  it('a logged-in visitor at /mobile is not redirected', () => {
    authStore.login('member@test.com', 'password123');
    render(Layout);
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('mobile +layout — 暖機清單(R14 F3)', () => {
  const notifGets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/notifications').length;
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('登入後 GET /notifications 恰好一次;重新 render 不再打(閘門守衛擋重訪)', async () => {
    authStore.login('member@test.com', 'password123');
    const first = render(Layout);
    await settle();
    expect(notifGets()).toBe(1);

    first.unmount();
    render(Layout);
    await settle();
    expect(notifGets()).toBe(1);
  });

  it('未登入零次(守門導走)', async () => {
    render(Layout);
    await settle();
    expect(notifGets()).toBe(0);
  });
});

describe('mobile +layout — 換人時關掉 overlay', () => {
  it('A→B:overlay 在 slot 外面也會讀個人資料,換人時 closeAll', async () => {
    await authStore.login('a', 'pw');
    render(Layout);
    overlay.push('settings');
    await authStore.login('b', 'pw');
    await tick();
    expect(get(overlay).stack).toHaveLength(0);
  });
});

describePageLifetime('mobile +layout', Layout, { 'GET /notifications': [] });
