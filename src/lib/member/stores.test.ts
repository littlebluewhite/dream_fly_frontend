import { describe, it, expect, beforeEach } from 'vitest';
import { subscriptions, points, pointsLedger } from './stores';
import { POINTS_LEDGER } from '$lib/testing/seed-fixtures';

// R13 Task 3:mock 會員 ME 退役;points 的起始值改用本地常數。
const SEED_POINTS = 1250;

// The singleton subscriptions persist to localStorage; reset it (and storage)
// between tests.
beforeEach(() => {
  localStorage.clear();
  subscriptions.set([]);
  points.set(SEED_POINTS);
  pointsLedger.set(POINTS_LEDGER.map((e) => ({ ...e })));
});

describe('subscriptions (truth is the server now — Task 17 removed client persistence)', () => {
  it('does NOT write entitlements to localStorage; the server (refreshSubscriptions) is the only source of truth', () => {
    subscriptions.set([{ id: 'product-uuid-1', name: '單堂體驗課', since: '2026/06/17', price: 500 }]);
    expect(localStorage.getItem('dreamfly_subscriptions')).toBeNull();
  });
});

// applyOrder（本地結算寫入）已隨 Task 16 移除 — 真訂單改由 stores.ts 的
// syncCartToServer / placeOrder / refreshSubscriptions / refreshPoints 接手
// （見 checkout-api.test.ts），points/pointsLedger/subscriptions/cart 的寫入
// 改成 API 回應驅動的 hydrate，而非本地 CheckoutResult 的加總。
