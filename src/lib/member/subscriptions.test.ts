/* Dream Fly — member/subscriptions.ts 接線單測:GET /subscriptions/me → subscriptions store。
 * 閘門協定(換身分重置、在飛作廢)的釘子住 session-gate.test.ts,這裡只留映射。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { subscriptions, refreshSubscriptions } from './stores';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(() => {
  subscriptions.set([]);
  vi.mocked(api).mockReset();
});

describe('refreshSubscriptions', () => {
  it('只留 status=active；id 換成 product_id；price_cents 換算 NT$；since 取 started_at 前 10 碼', async () => {
    vi.mocked(api).mockResolvedValue([
      {
        id: 'sub-1',
        product_id: 'prod-a',
        product_name: '方案A',
        status: 'active',
        started_at: '2026-06-01T00:00:00Z',
        expires_at: null,
        total_sessions: null,
        remaining_sessions: null,
        price_cents: 300000
      },
      {
        id: 'sub-2',
        product_id: 'prod-b',
        product_name: '方案B',
        status: 'expired',
        started_at: '2025-01-01T00:00:00Z',
        expires_at: '2025-12-31T00:00:00Z',
        total_sessions: 10,
        remaining_sessions: 0,
        price_cents: 200000
      }
    ]);

    await refreshSubscriptions();

    // expired 不算「已持有」— 不該擋掉重新購買，所以不進本地 subscriptions。
    expect(get(subscriptions)).toEqual([{ id: 'prod-a', name: '方案A', since: '2026-06-01', price: 3000 }]);
  });

  it('全部都不是 active → subscriptions 清空', async () => {
    vi.mocked(api).mockResolvedValue([
      {
        id: 'sub-1',
        product_id: 'prod-a',
        product_name: '方案A',
        status: 'cancelled',
        started_at: '2026-06-01T00:00:00Z',
        expires_at: null,
        total_sessions: null,
        remaining_sessions: null,
        price_cents: 300000
      }
    ]);

    await refreshSubscriptions();

    expect(get(subscriptions)).toEqual([]);
  });

});
