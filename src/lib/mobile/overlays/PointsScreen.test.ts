import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { points, pointsLedger } from '$lib/member/points';
import { toasts } from '$lib/mobile/stores';
import { api, ApiError } from '$lib/api/client';
import PointsScreen from './PointsScreen.svelte';
import { fakeRouter } from '$lib/testing/fake-router';
import { pointsMe, rewardResponse } from '$lib/testing/wire-fixtures';
import type { RewardListResponse } from '$lib/api/generated';

/* Task 19：PointsScreen 改真後端 —— 兌換品項復用桌面 getPoints()(Task 14 rewards
 * seam)；餘額/明細/兌換動作改讀 $lib/member/points 的真 points/pointsLedger/
 * redeemReward()。同 src/routes/member/points/page.test.ts 的慣例：只 mock
 * $lib/api/client 的 api()，getPoints/兌換/hydrate 邏輯本身用真實實作端對端驗證。
 * mobile 版沒有桌面的「確認兌換」對話框 —— 這裡改為點擊
 * 「兌換」即直接送出(mobile 既有的單點互動慣例)，故對應測試略去對話框步驟。
 * Task 7(架構深化 R15·F-4)：元件改直取 $lib/member/api / $lib/member/points。
 * W4d：getPoints 也改走 HTTP seam(GET /rewards + 內含的 refreshPoints → GET /points/me)，
 * 畫面文字斷言不變。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const REWARD_AFFORDABLE = rewardResponse({ id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', points_cost: 100, stock: null });
const REWARD_SOLDOUT = rewardResponse({ id: 'rw-2', name: '限量托特包', description: '夢飛限定托特包，數量有限。', points_cost: 50, stock: 0 });
const REWARD_EXPENSIVE = rewardResponse({ id: 'rw-3', name: '單堂體驗課兌換券', description: null, points_cost: 5000, stock: 5 });
const REWARDS = { rewards: [REWARD_AFFORDABLE, REWARD_SOLDOUT, REWARD_EXPENSIVE] } satisfies RewardListResponse;

/** 餘額 1000 由 GET /points/me 提供(getPoints 內的 refreshPoints 會水合 store)。 */
const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(over, { 'GET /rewards': REWARDS, 'GET /points/me': pointsMe({ balance: 1000 }) }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	points.set(0);
	pointsLedger.set([]);
});

describe('PointsScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記(data-testid="points-skeleton")', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(PointsScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="points-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /rewards': new Error('boom') });
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示真實餘額($lib/member/points 的 points，非 mobile 本地 mock)', async () => {
		route({ 'GET /points/me': pointsMe({ balance: 2500 }) });
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('2,500')).toBeInTheDocument();
	});
});

describe('PointsScreen — 兌換品項卡片渲染(Task 14：GET /rewards 真形狀)', () => {
	it('顯示 name/description/pointsCost；stock=null(不限量)可正常兌換', async () => {
		route();
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('報名費折抵 NT$100');
		expect(screen.getByText('下次報名課程可折抵 NT$100。')).toBeInTheDocument();
		expect(screen.getByText('100 點')).toBeInTheDocument();
		expect(screen.getByText('兌換').closest('button')).not.toBeDisabled();
	});

	it('stock=0 顯示「已兌換完畢」且按鈕停用，即使點數足夠負擔該品項', async () => {
		route();
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('限量托特包');
		expect(screen.getByText('已兌換完畢').closest('button')).toBeDisabled();
	});

	it('點數不足時顯示「點數不足」且按鈕停用(不是 stock 問題)', async () => {
		route();
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('單堂體驗課兌換券');
		expect(screen.getByText('點數不足').closest('button')).toBeDisabled();
	});

	it('description 為 null 時不拋出', async () => {
		route();
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('單堂體驗課兌換券')).toBeInTheDocument();
	});
});

describe('PointsScreen — 兌換流程(Task 14：POST /rewards/{id}/redeem，一鍵送出無確認對話框)', () => {
	it('點擊兌換 → POST /rewards/{id}/redeem(無 body) → 成功後 hydrate points/pointsLedger、顯示 toast', async () => {
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
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		await fireEvent.click(screen.getByText('兌換'));

		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledWith('/rewards/rw-1/redeem', { method: 'POST' });
		});
		expect(api).toHaveBeenCalledWith('/points/me');
		await vi.waitFor(() => expect(get(points)).toBe(900)); // 來自 GET /points/me 回應，不是本地算出來的
		expect(notifySpy).toHaveBeenCalledWith('success', '兌換成功', expect.stringContaining('報名費折抵 NT$100'));
	});

	it('409「點數不足」顯示對應繁中錯誤 toast，不清空/凍結畫面', async () => {
		route({ 'POST /rewards/rw-1/redeem': new ApiError(409, '點數不足') });
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		await fireEvent.click(screen.getByText('兌換'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '兌換失敗', '點數不足');
		});
	});

	it('in-flight guard：兌換中重複點擊，只送出一次 POST 請求', async () => {
		let resolveRedeem!: (v: unknown) => void;
		const pending = new Promise((resolve) => { resolveRedeem = resolve; });
		let pointsFetches = 0;
		route({
			'POST /rewards/rw-1/redeem': () => pending,
			'GET /points/me': () => (++pointsFetches === 1 ? pointsMe({ balance: 1000 }) : pointsMe({ balance: 900 }))
		});
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		const btn = screen.getByText('兌換');
		await fireEvent.click(btn);
		await fireEvent.click(btn);
		await fireEvent.click(btn);

		resolveRedeem({ redemption_id: 'red-1', points_spent: 100, balance_after: 900 });
		await vi.waitFor(() => expect(get(points)).toBe(900));

		const postCalls = vi.mocked(api).mock.calls.filter(
			([p, i]) => p === '/rewards/rw-1/redeem' && (i as RequestInit | undefined)?.method === 'POST'
		);
		expect(postCalls).toHaveLength(1);
	});
});

describe('PointsScreen — 點數明細 tab(真 pointsLedger)', () => {
	it('切換到點數明細顯示真實 ledger 內容', async () => {
		route({
			'GET /points/me': pointsMe({
				balance: 1000,
				ledger: [{ id: 'l1', delta: 120, balance_after: 1000, reason: 'checkout_earn', order_id: null, created_at: '2026-07-01T00:00:00Z' }]
			})
		});
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		await fireEvent.click(screen.getByText('點數明細'));

		expect(await screen.findByText('消費獲得點數')).toBeInTheDocument();
		expect(screen.getByText('+120')).toBeInTheDocument();
	});
});
