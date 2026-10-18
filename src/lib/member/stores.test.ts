import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '$lib/api/client';
import { refreshSubscriptions } from './stores';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { subscriptionResponse } from '$lib/testing/wire-fixtures';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(async () => {
  localStorage.clear();
  await resetSessionStores();
});

describe('subscriptions (truth is the server now — Task 17 removed client persistence)', () => {
  it('does NOT write entitlements to localStorage; the server (refreshSubscriptions) is the only source of truth', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /subscriptions/me': [subscriptionResponse({ product_id: 'product-uuid-1' })] }));
    await refreshSubscriptions();
    expect(localStorage.getItem('dreamfly_subscriptions')).toBeNull();
  });
});

// applyOrder（本地結算寫入）已隨 Task 16 移除 — 真訂單改由 checkout-sync.ts 的
// createCheckout（送單）與 refreshSubscriptions / refreshPoints 接手（見
// checkout-sync.test.ts、subscriptions.test.ts、points.test.ts），points/pointsLedger/subscriptions/cart 的寫入
// 改成 API 回應驅動的 hydrate，而非本地 CheckoutResult 的加總。
