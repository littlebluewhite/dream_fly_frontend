import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { getPoints } from '$lib/member/api';
import { REWARDS, POINTS_LEDGER } from '$lib/member/data';
import { pointsLedger } from '$lib/member/stores';
import Page from './+page.svelte';

vi.mock('$lib/member/api', () => ({ getPoints: vi.fn() }));

const SEED = { rewards: REWARDS, expiring: '360 點', expiryDate: '2026/12/31' };

beforeEach(() => {
  vi.mocked(getPoints).mockReset();
  pointsLedger.set(POINTS_LEDGER.map((e) => ({ ...e })));
});

describe('member/points 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    expect(screen.queryByText('點數兌換')).toBeNull();
    expect(await screen.findByText('點數兌換')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    vi.mocked(getPoints).mockRejectedValue(new Error('boom'));
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記(data-testid="points-skeleton")', () => {
    vi.mocked(getPoints).mockReturnValue(new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="points-skeleton"]')).not.toBeNull();
  });

  it('ready 後顯示硬編到期資料(由 getPoints 接縫提供)', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    expect(await screen.findByText('360 點')).toBeInTheDocument();
    expect(screen.getByText('2026/12/31')).toBeInTheDocument();
  });

  it('本月累積依「當下月份」動態計算 — 當月 earn 計入、非當月與負值排除', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    // 動態算出「當月」prefix（與頁面同一種 YYYY/MM 補零格式）；非當月項目用
    // 一個永遠不可能是當月的年份，避免測試自己做易錯的月份加減。
    const now = new Date();
    const prefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    pointsLedger.set([
      { id: 'cur-earn', date: `${prefix}/03`, desc: '消費獲得點數', type: 'earn', delta: 120 },
      { id: 'cur-redeem', date: `${prefix}/05`, desc: '消費折抵點數', type: 'redeem', delta: -50 },
      { id: 'old-earn', date: '2000/01/15', desc: '消費獲得點數', type: 'earn', delta: 300 }
    ]);
    render(Page);

    const label = await screen.findByText('本月累積');
    expect(label.nextElementSibling?.textContent).toBe('+120'); // 不是 +0（凍結在 2026/06）也不是 +420
  });
});
