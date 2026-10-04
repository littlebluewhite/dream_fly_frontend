import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { points, pointsLedger, toasts } from '$lib/member/stores';
import type { PointsMeResponse, RewardListResponse } from '$lib/api/generated';
import { api, ApiError } from '$lib/api/client';
import Page from './+page.svelte';
import { fakeRouter } from '$lib/testing/fake-router';
import { apiCalls } from '$lib/testing/admin-routes';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import { pointsMe, rewardResponse } from '$lib/testing/wire-fixtures';

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
const REWARD_AFFORDABLE = rewardResponse({ id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', points_cost: 100, stock: null });
const REWARD_SOLDOUT = rewardResponse({ id: 'rw-2', name: '限量托特包', description: '夢飛限定托特包，數量有限。', points_cost: 50, stock: 0 });
const REWARD_EXPENSIVE = rewardResponse({ id: 'rw-3', name: '單堂體驗課兌換券', description: null, points_cost: 5000, stock: 5 });

const REWARDS = { rewards: [REWARD_AFFORDABLE, REWARD_SOLDOUT, REWARD_EXPENSIVE] } satisfies RewardListResponse;

/** 餘額 1000 由 GET /points/me 路由提供(getPoints 內的 refreshPoints 會水合 store)。 */
const route = (over: Record<string, unknown> = {}) =>
  vi.mocked(api).mockImplementation(
    fakeRouter(over, { ...MEMBER_ROUTES, 'GET /rewards': REWARDS, 'GET /points/me': pointsMe({ balance: 1000 }) })
  );

beforeEach(() => {
  vi.mocked(api).mockReset();
  points.set(0);
  pointsLedger.set([]);
});

describe('member/points 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    route();
    render(Page);
    expect(screen.queryByText('點數兌換')).toBeNull();
    expect(await screen.findByText('點數兌換')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    route({ 'GET /rewards': new Error('boom') });
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記(data-testid="points-skeleton")', () => {
    vi.mocked(api).mockImplementation(() => new Promise(() => {}));
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="points-skeleton"]')).not.toBeNull();
  });

  it('ready 後顯示硬編到期資料(由 getPoints 接縫提供)', async () => {
    route();
    render(Page);
    expect(await screen.findByText('360 點')).toBeInTheDocument();
    expect(screen.getByText('2026/12/31')).toBeInTheDocument();
  });

  it('本月累積顯示後端 earned_this_month，不從明細加總(明細和 ≠ earned_this_month)', async () => {
    // 明細是當月 +120 與 -50(加總正值 = 120、淨額 = 70)，後端 earned_this_month = 450
    // (含不在第一頁的當月入帳)——頁面只能顯示 450。
    route({
      'GET /points/me': {
        balance: 1000,
        earned_this_month: 450,
        ledger: [
          { id: 'l1', delta: 120, balance_after: 1000, reason: 'checkout_earn', order_id: 'o1', created_at: new Date().toISOString() },
          { id: 'l2', delta: -50, balance_after: 880, reason: 'checkout_redeem', order_id: 'o2', created_at: new Date().toISOString() }
        ],
        total: 7, page: 1, per_page: 2
      } satisfies PointsMeResponse
    });
    render(Page);

    const label = await screen.findByText('本月累積');
    expect(label.nextElementSibling?.textContent).toBe('+450');
  });
});

describe('member/points 頁 — 兌換品項卡片渲染（Task 14：GET /rewards 真形狀）', () => {
  it('顯示 name/description/pointsCost；stock=null(不限量)可正常兌換', async () => {
    route();
    render(Page);

    await screen.findByText('報名費折抵 NT$100');
    expect(screen.getByText('下次報名課程可折抵 NT$100。')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('兌換').closest('button')).not.toBeDisabled();
  });

  it('stock=0 顯示「已兌換完畢」且按鈕停用，即使點數足夠負擔該品項', async () => {
    route();
    render(Page);

    await screen.findByText('限量托特包');
    // $points=1000 遠高於 REWARD_SOLDOUT 的 50 點成本——售罄狀態仍須優先於「可負擔」
    const btn = screen.getByText('已兌換完畢').closest('button');
    expect(btn).toBeDisabled();
  });

  it('description 為 null 時不拋出、渲染為空白', async () => {
    route();
    render(Page);
    expect(await screen.findByText('單堂體驗課兌換券')).toBeInTheDocument();
  });

  it('點數不足時顯示「點數不足」且按鈕停用（不是 stock 問題）', async () => {
    route();
    render(Page);

    await screen.findByText('單堂體驗課兌換券');
    const btn = screen.getByText('點數不足').closest('button');
    expect(btn).toBeDisabled();
  });
});

describe('member/points 頁 — 兌換流程（Task 14：POST /rewards/{id}/redeem）', () => {
  it('點擊兌換開啟確認對話框，內容含品項名稱與點數', async () => {
    route();
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));

    const dialog = await screen.findByRole('dialog'); // 「確認兌換」同時是標題與按鈕文字，用 role 消歧義
    expect(dialog.textContent).toContain('報名費折抵 NT$100');
    expect(dialog.textContent).toContain('100 點');
  });

  it('確認兌換 → POST /rewards/{id}/redeem(無 body) → 成功後 hydrate points/pointsLedger、顯示 toast、關閉對話框', async () => {
    // 第 1 次 GET /points/me 是進頁水合(餘額 1000)，第 2 次才是兌換後的 refreshPoints(餘額 900)。
    let pointsFetches = 0;
    route({
      'POST /rewards/rw-1/redeem': { redemption_id: 'red-1', points_spent: 100, balance_after: 900 },
      'GET /points/me': () =>
        ++pointsFetches === 1
          ? pointsMe({ balance: 1000 })
          : pointsMe({
              balance: 900,
              ledger: [{ id: 'l1', delta: -100, balance_after: 900, reason: 'redeem', order_id: null, created_at: '2026-07-06T00:00:00Z' }]
            })
    });
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
    route({ 'POST /rewards/rw-1/redeem': new ApiError(409, '點數不足') });
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
    route({ 'POST /rewards/rw-1/redeem': new ApiError(409, '已兌換完畢') });
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
    route();
    render(Page);
    await screen.findByText('報名費折抵 NT$100');

    await fireEvent.click(screen.getByText('兌換'));
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(apiCalls('POST /rewards/rw-1/redeem')).toHaveLength(0); // 進頁的 GET 不算，只確認沒送出兌換
  });

  it('in-flight guard：兌換中重複點擊確認鈕，只送出一次 POST 請求', async () => {
    let resolveRedeem!: (v: unknown) => void;
    const pending = new Promise((resolve) => { resolveRedeem = resolve; });
    route({ 'POST /rewards/rw-1/redeem': () => pending });
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

    expect(apiCalls('POST /rewards/rw-1/redeem')).toHaveLength(1);
  });
});
