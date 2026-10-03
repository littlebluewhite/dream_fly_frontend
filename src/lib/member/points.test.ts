/* Dream Fly — member/points.ts 接線單測:GET /points/me → points / pointsLedger /
 * pointsEarnedThisMonth 映射。閘門協定(換身分重置、在飛作廢)的釘子住 session-gate.test.ts,
 * 這裡只留映射 + 一條「本月累積已接上 reset」的薄 adapter 釘。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import type { PointsMeResponse } from '$lib/api/generated';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { points, pointsLedger, pointsEarnedThisMonth, refreshPoints } from './stores';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(() => {
  points.set(0);
  pointsLedger.set([]);
  pointsEarnedThisMonth.set(0);
  vi.mocked(api).mockReset();
});

describe('refreshPoints', () => {
  it('把 balance 寫入 points store', async () => {
    vi.mocked(api).mockResolvedValue({ balance: 888, earned_this_month: 0, ledger: [], total: 0, page: 1, per_page: 20 } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(points)).toBe(888);
  });

  it('ledger 依 reason 映射 desc/type；date 取 created_at 前 10 碼並轉成 YYYY/MM/DD(Task 17)', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 500,
      earned_this_month: 0,
      ledger: [
        { id: 'l1', delta: 120, balance_after: 500, reason: 'checkout_earn', order_id: 'o1', created_at: '2026-07-01T09:00:00Z' },
        { id: 'l2', delta: -300, balance_after: 380, reason: 'checkout_redeem', order_id: 'o2', created_at: '2026-06-20T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l1', date: '2026/07/01', desc: '消費獲得點數', type: 'earn', delta: 120 },
      { id: 'l2', date: '2026/06/20', desc: '消費折抵點數', type: 'redeem', delta: -300 }
    ]);
  });

  it('admin_adjust 有專屬 adjust bucket，正負號都用同一個「會員點數調整」', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 0,
      earned_this_month: 0,
      ledger: [
        { id: 'l3', delta: 50, balance_after: 50, reason: 'admin_adjust', order_id: null, created_at: '2026-05-01T00:00:00Z' },
        { id: 'l4', delta: -20, balance_after: 30, reason: 'admin_adjust', order_id: null, created_at: '2026-05-02T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l3', date: '2026/05/01', desc: '會員點數調整', type: 'adjust', delta: 50 },
      { id: 'l4', date: '2026/05/02', desc: '會員點數調整', type: 'adjust', delta: -20 }
    ]);
  });

  it('refund_restore / refund_clawback 各有專屬退款文案，type 皆為 refund', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 0,
      earned_this_month: 0,
      ledger: [
        { id: 'r1', delta: 300, balance_after: 300, reason: 'refund_restore', order_id: 'o1', created_at: '2026-07-02T00:00:00Z' },
        { id: 'r2', delta: -120, balance_after: 180, reason: 'refund_clawback', order_id: 'o1', created_at: '2026-07-03T00:00:00Z' }
      ],
      total: 2, page: 1, per_page: 20
    } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'r1', date: '2026/07/02', desc: '訂單退款・退回折抵點數', type: 'refund', delta: 300 },
      { id: 'r2', date: '2026/07/03', desc: '訂單退款・收回回饋點數', type: 'refund', delta: -120 }
    ]);
  });

  it('redeem（點數兌換扣點，Task 14）有專屬 desc/type，與 checkout_redeem 分開', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 400,
      earned_this_month: 0,
      ledger: [{ id: 'l5', delta: -100, balance_after: 400, reason: 'redeem', order_id: null, created_at: '2026-07-06T00:00:00Z' }],
      total: 1, page: 1, per_page: 20
    } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(pointsLedger)).toEqual([
      { id: 'l5', date: '2026/07/06', desc: '兌換點數獎勵', type: 'redeem', delta: -100 }
    ]);
  });

  it('earned_this_month 原樣寫入 pointsEarnedThisMonth(後端工作室月份計算，前端不從明細加總)', async () => {
    vi.mocked(api).mockResolvedValue({
      balance: 500,
      earned_this_month: 320,
      ledger: [{ id: 'l1', delta: 120, balance_after: 500, reason: 'checkout_earn', order_id: 'o1', created_at: '2026-07-01T09:00:00Z' }],
      total: 9, page: 1, per_page: 1
    } satisfies PointsMeResponse);

    await refreshPoints();

    expect(get(pointsEarnedThisMonth)).toBe(320);
  });

  it('換身分(登出)沿 session 閘門既有 reset 邊沿把本月累積歸零', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /auth/login': {
          access_token: 'at-p', refresh_token: 'rt-p',
          user: {
            id: 'u-p', email: 'p@dreamfly.test', name: '甲', phone: null, phone_verified: false,
            avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member']
          }
        },
        'POST /auth/logout': undefined,
        'GET /points/me': { balance: 10, earned_this_month: 77, ledger: [], total: 0, page: 1, per_page: 20 } satisfies PointsMeResponse
      })
    );
    await authStore.login('p@dreamfly.test', 'pw');
    await refreshPoints();
    expect(get(pointsEarnedThisMonth)).toBe(77);

    await authStore.logout();

    expect(get(pointsEarnedThisMonth)).toBe(0);
  });
});
