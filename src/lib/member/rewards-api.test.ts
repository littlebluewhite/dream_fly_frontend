/* Dream Fly — member 點數兌換「真 API」網路層單測（Task 14；integration-contract.md
 * §3.23 Rewards）。
 *
 * 覆蓋 stores.ts 新增的兌換網路層：redeemReward / redeemRewardErrorMessage，含
 * 兌換成功後 refreshPoints() 的 hydrate 呼叫序列。只替換 $lib/api/client 的
 * api()，ApiError 用回真實類別（同 leave-requests-api.test.ts 慣例）。呼叫序列
 * （path/method/body）是核心斷言，不是只驗證最終 store 狀態。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { points, pointsLedger, redeemReward, redeemRewardErrorMessage } from './stores';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

beforeEach(() => {
  vi.mocked(api).mockReset();
  points.set(0);
  pointsLedger.set([]);
});

describe('redeemReward — POST /rewards/{id}/redeem', () => {
  it('無 body 呼叫 POST /rewards/{id}/redeem，成功後呼叫 refreshPoints() 整包 hydrate points/pointsLedger（非本地扣減）', async () => {
    points.set(500); // 先前餘額——驗證最終值來自 refreshPoints 的回應，不是 500-100 本地算出來的
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /rewards/rw-1/redeem': { redemption_id: 'redemption-1', points_spent: 100, balance_after: 900 },
        'GET /points/me': {
          balance: 900,
          ledger: [{ id: 'l1', delta: -100, balance_after: 900, reason: 'redeem', order_id: null, created_at: '2026-07-06T00:00:00Z' }]
        }
      })
    );

    const result = await redeemReward('rw-1');

    expect(api).toHaveBeenCalledWith('/rewards/rw-1/redeem', { method: 'POST' });
    expect(api).toHaveBeenCalledWith('/points/me');
    expect(result).toEqual({ redemption_id: 'redemption-1', points_spent: 100, balance_after: 900 });
    expect(get(points)).toBe(900); // 來自 GET /points/me 的 balance，不是本地 500-100
    expect(get(pointsLedger)).toEqual([{ id: 'l1', date: '2026/07/06', desc: '兌換點數獎勵', type: 'redeem', delta: -100 }]);
  });

  it('呼叫序列：先 POST /rewards/{id}/redeem，成功後才呼叫 GET /points/me', async () => {
    const calls: string[] = [];
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      calls.push(`${method} ${path}`);
      if (method === 'POST' && path === '/rewards/rw-1/redeem') {
        return { redemption_id: 'r1', points_spent: 100, balance_after: 400 };
      }
      if (path === '/points/me') return { balance: 400, ledger: [] };
      throw new Error('unexpected api call: ' + method + ' ' + path);
    });

    await redeemReward('rw-1');

    expect(calls).toEqual(['POST /rewards/rw-1/redeem', 'GET /points/me']);
  });

  it('409「點數不足」原樣拋出，且不觸發 refreshPoints（store 維持原狀）', async () => {
    points.set(50);
    pointsLedger.set([{ id: 'old', date: '2026/07/01', desc: '舊紀錄', type: 'earn', delta: 50 }]);
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(409, '點數不足') }));

    await expect(redeemReward('rw-1')).rejects.toThrow('點數不足');
    expect(get(points)).toBe(50); // 未被觸動
    expect(get(pointsLedger)).toHaveLength(1);
  });

  it('409「已兌換完畢」（庫存售罄）原樣拋出', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(409, '已兌換完畢') }));
    await expect(redeemReward('rw-1')).rejects.toThrow('已兌換完畢');
  });

  it('404（獎勵不存在或已下架）原樣拋出', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(404, '獎勵不存在') }));
    await expect(redeemReward('rw-1')).rejects.toThrow('獎勵不存在');
  });
});

describe('redeemRewardErrorMessage', () => {
  it('直通 ApiError.message（後端已回繁中契約原文，兩種 409 + 404）', () => {
    expect(redeemRewardErrorMessage(new ApiError(409, '點數不足'))).toBe('點數不足');
    expect(redeemRewardErrorMessage(new ApiError(409, '已兌換完畢'))).toBe('已兌換完畢');
    expect(redeemRewardErrorMessage(new ApiError(404, '獎勵不存在'))).toBe('獎勵不存在');
  });

  it('非 ApiError（網路失敗等）fallback 為通用文案', () => {
    expect(redeemRewardErrorMessage(new Error('network down'))).toBe('連線發生問題，請稍後再試。');
  });
});
