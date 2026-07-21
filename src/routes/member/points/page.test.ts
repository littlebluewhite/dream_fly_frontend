import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { getPoints, type Reward } from '$lib/member/api';
import { POINTS_LEDGER } from '$lib/member/data';
import { points, pointsLedger, toasts } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import Page from './+page.svelte';
import { fakeRouter } from '$lib/testing/fake-router';

vi.mock('$lib/member/api', () => ({ getPoints: vi.fn() }));

// Task 14：兌換動作(redeemReward)/hydrate(refreshPoints)在 $lib/member/stores 用
// 真實實作，只替換 $lib/api/client 的 api()（同 LeaveDialog.test.ts 慣例）——這樣
// 才是端對端驗證「按下確認兌換 → 真的打 POST /rewards/{id}/redeem → 真的重新
// GET /points/me」，而不是把兌換邏輯本身也 mock 掉。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

// 三個品項各代表一種按鈕狀態(搭配 beforeEach 的 points.set(1000))：
// AFFORDABLE(100 點,不限量) → 可兌換；SOLDOUT(50 點但 stock 0) → 即使付得起也
// 售罄優先；EXPENSIVE(5000 點) → 點數不足。
const REWARD_AFFORDABLE: Reward = { id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', pointsCost: 100, stock: null };
const REWARD_SOLDOUT: Reward = { id: 'rw-2', name: '限量托特包', description: '夢飛限定托特包，數量有限。', pointsCost: 50, stock: 0 };
const REWARD_EXPENSIVE: Reward = { id: 'rw-3', name: '單堂體驗課兌換券', description: null, pointsCost: 5000, stock: 5 };

const SEED = { rewards: [REWARD_AFFORDABLE, REWARD_SOLDOUT, REWARD_EXPENSIVE], expiring: '360 點', expiryDate: '2026/12/31' };

beforeEach(() => {
  vi.mocked(getPoints).mockReset();
  vi.mocked(api).mockReset();
  points.set(1000);
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

describe('member/points 頁 — 兌換品項卡片渲染（Task 14：GET /rewards 真形狀）', () => {
  it('顯示 name/description/pointsCost；stock=null(不限量)可正常兌換', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);

    await screen.findByText('報名費折抵 NT$100');
    expect(screen.getByText('下次報名課程可折抵 NT$100。')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('兌換').closest('button')).not.toBeDisabled();
  });

  it('stock=0 顯示「已兌換完畢」且按鈕停用，即使點數足夠負擔該品項', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);

    await screen.findByText('限量托特包');
    // $points=1000 遠高於 REWARD_SOLDOUT 的 50 點成本——售罄狀態仍須優先於「可負擔」
    const btn = screen.getByText('已兌換完畢').closest('button');
    expect(btn).toBeDisabled();
  });

  it('description 為 null 時不拋出、渲染為空白', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    expect(await screen.findByText('單堂體驗課兌換券')).toBeInTheDocument();
  });

  it('點數不足時顯示「點數不足」且按鈕停用（不是 stock 問題）', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);

    await screen.findByText('單堂體驗課兌換券');
    const btn = screen.getByText('點數不足').closest('button');
    expect(btn).toBeDisabled();
  });
});

describe('member/points 頁 — 兌換流程（Task 14：POST /rewards/{id}/redeem）', () => {
  it('點擊兌換開啟確認對話框，內容含品項名稱與點數', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));

    const dialog = await screen.findByRole('dialog'); // 「確認兌換」同時是標題與按鈕文字，用 role 消歧義
    expect(dialog.textContent).toContain('報名費折抵 NT$100');
    expect(dialog.textContent).toContain('100 點');
  });

  it('確認兌換 → POST /rewards/{id}/redeem(無 body) → 成功後 hydrate points/pointsLedger、顯示 toast、關閉對話框', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'POST /rewards/rw-1/redeem': { redemption_id: 'red-1', points_spent: 100, balance_after: 900 },
        'GET /points/me': {
          balance: 900,
          ledger: [{ id: 'l1', delta: -100, balance_after: 900, reason: 'redeem', order_id: null, created_at: '2026-07-06T00:00:00Z' }]
        }
      })
    );
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: '確認兌換' }));

    await vi.waitFor(() => {
      expect(api).toHaveBeenCalledWith('/rewards/rw-1/redeem', { method: 'POST' });
    });
    expect(api).toHaveBeenCalledWith('/points/me'); // refreshPoints 整包 hydrate
    await vi.waitFor(() => expect(get(points)).toBe(900)); // 來自 GET /points/me 回應，不是本地 1000-100 算出來的
    expect(get(pointsLedger)[0]).toEqual({ id: 'l1', date: '2026/07/06', desc: '兌換點數獎勵', type: 'redeem', delta: -100 });
    expect(notifySpy).toHaveBeenCalledWith('success', '兌換成功', expect.stringContaining('報名費折抵 NT$100'));
    expect(screen.queryByRole('dialog')).toBeNull(); // 對話框已關閉
  });

  it('409「點數不足」顯示對應繁中錯誤 toast，對話框保留（可重試/手動取消）', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(409, '點數不足') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: '確認兌換' }));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '兌換失敗', '點數不足');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('409「已兌換完畢」顯示對應繁中錯誤 toast', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(409, '已兌換完畢') }));
    const notifySpy = vi.spyOn(toasts, 'notify');
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: '確認兌換' }));

    await vi.waitFor(() => {
      expect(notifySpy).toHaveBeenCalledWith('error', '兌換失敗', '已兌換完畢');
    });
  });

  it('點擊「取消」關閉對話框、不呼叫 API', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('in-flight guard：兌換中重複點擊確認鈕，只送出一次 POST 請求', async () => {
    vi.mocked(getPoints).mockResolvedValue(SEED);
    let resolveRedeem!: (v: unknown) => void;
    const pending = new Promise((resolve) => { resolveRedeem = resolve; });
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      if (method === 'POST' && path === '/rewards/rw-1/redeem') return pending;
      if (path === '/points/me') return { balance: 900, ledger: [] };
      throw new Error('unexpected api call: ' + method + ' ' + path);
    });
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    const confirmBtn = screen.getByRole('button', { name: /確認兌換|兌換中/ });

    await fireEvent.click(confirmBtn);
    await fireEvent.click(confirmBtn);
    await fireEvent.click(confirmBtn);

    resolveRedeem({ redemption_id: 'red-1', points_spent: 100, balance_after: 900 });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const postCalls = vi.mocked(api).mock.calls.filter(
      ([p, i]) => p === '/rewards/rw-1/redeem' && (i as RequestInit | undefined)?.method === 'POST'
    );
    expect(postCalls).toHaveLength(1);
  });
});
