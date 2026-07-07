import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { getPoints, type Reward } from '$lib/mobile/api';
import { points, pointsLedger } from '$lib/member/stores';
import { toasts } from '$lib/mobile/stores';
import { api, ApiError } from '$lib/api/client';
import PointsScreen from './PointsScreen.svelte';

/* Task 19：PointsScreen 改真後端 —— 兌換品項復用桌面 getPoints()(Task 14 rewards
 * seam)；餘額/明細/兌換動作改讀 $lib/member/stores 的真 points/pointsLedger/
 * redeemReward()。同 src/routes/member/points/page.test.ts 的慣例：只 mock
 * $lib/mobile/api 的 getPoints 與 $lib/api/client 的 api()，兌換/hydrate 邏輯本身
 * 用真實實作端對端驗證。mobile 版沒有桌面的「確認兌換」對話框 —— 這裡改為點擊
 * 「兌換」即直接送出(mobile 既有的單點互動慣例)，故對應測試略去對話框步驟。 */
vi.mock('$lib/mobile/api', () => ({ getPoints: vi.fn() }));
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

function fakeRouter(overrides: Record<string, unknown>) {
	return vi.fn(async (path: string, init: RequestInit = {}) => {
		const method = (init.method ?? 'GET').toString().toUpperCase();
		const key = `${method} ${path}`;
		if (key in overrides) {
			const value = overrides[key];
			if (value instanceof Error) throw value;
			return value;
		}
		throw new Error(`unexpected api call: ${key}`);
	});
}

const REWARD_AFFORDABLE: Reward = { id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', pointsCost: 100, stock: null };
const REWARD_SOLDOUT: Reward = { id: 'rw-2', name: '限量托特包', description: '夢飛限定托特包，數量有限。', pointsCost: 50, stock: 0 };
const REWARD_EXPENSIVE: Reward = { id: 'rw-3', name: '單堂體驗課兌換券', description: null, pointsCost: 5000, stock: 5 };
const SEED = { rewards: [REWARD_AFFORDABLE, REWARD_SOLDOUT, REWARD_EXPENSIVE], expiring: '360 點', expiryDate: '2026/12/31' };

beforeEach(() => {
	vi.mocked(getPoints).mockReset();
	vi.mocked(api).mockReset();
	points.set(1000);
	pointsLedger.set([]);
});

describe('PointsScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記(data-testid="points-skeleton")', () => {
		vi.mocked(getPoints).mockReturnValue(new Promise(() => {}));
		const { container } = render(PointsScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="points-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getPoints).mockRejectedValue(new Error('boom'));
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示真實餘額($lib/member/stores 的 points，非 mobile 本地 mock)', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		points.set(2500);
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('2,500')).toBeInTheDocument();
	});
});

describe('PointsScreen — 兌換品項卡片渲染(Task 14：GET /rewards 真形狀)', () => {
	it('顯示 name/description/pointsCost；stock=null(不限量)可正常兌換', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('報名費折抵 NT$100');
		expect(screen.getByText('下次報名課程可折抵 NT$100。')).toBeInTheDocument();
		expect(screen.getByText('100 點')).toBeInTheDocument();
		expect(screen.getByText('兌換').closest('button')).not.toBeDisabled();
	});

	it('stock=0 顯示「已兌換完畢」且按鈕停用，即使點數足夠負擔該品項', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('限量托特包');
		expect(screen.getByText('已兌換完畢').closest('button')).toBeDisabled();
	});

	it('點數不足時顯示「點數不足」且按鈕停用(不是 stock 問題)', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		render(PointsScreen, { props: { onBack: () => {} } });

		await screen.findByText('單堂體驗課兌換券');
		expect(screen.getByText('點數不足').closest('button')).toBeDisabled();
	});

	it('description 為 null 時不拋出', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		render(PointsScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('單堂體驗課兌換券')).toBeInTheDocument();
	});
});

describe('PointsScreen — 兌換流程(Task 14：POST /rewards/{id}/redeem，一鍵送出無確認對話框)', () => {
	it('點擊兌換 → POST /rewards/{id}/redeem(無 body) → 成功後 hydrate points/pointsLedger、顯示 toast', async () => {
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
		vi.mocked(getPoints).mockResolvedValue(SEED);
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /rewards/rw-1/redeem': new ApiError(409, '點數不足') }));
		const notifySpy = vi.spyOn(toasts, 'notify');
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		await fireEvent.click(screen.getByText('兌換'));

		await vi.waitFor(() => {
			expect(notifySpy).toHaveBeenCalledWith('error', '兌換失敗', '點數不足');
		});
	});

	it('in-flight guard：兌換中重複點擊，只送出一次 POST 請求', async () => {
		vi.mocked(getPoints).mockResolvedValue(SEED);
		let resolveRedeem!: (v: unknown) => void;
		const pending = new Promise((resolve) => { resolveRedeem = resolve; });
		vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
			const method = (init.method ?? 'GET').toString().toUpperCase();
			if (method === 'POST' && path === '/rewards/rw-1/redeem') return pending;
			if (path === '/points/me') return { balance: 900, ledger: [] };
			throw new Error('unexpected api call: ' + method + ' ' + path);
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
		vi.mocked(getPoints).mockResolvedValue(SEED);
		pointsLedger.set([{ id: 'l1', date: '2026/07/01', desc: '消費獲得點數', type: 'earn', delta: 120 }]);
		render(PointsScreen, { props: { onBack: () => {} } });
		await screen.findByText('報名費折抵 NT$100');

		await fireEvent.click(screen.getByText('點數明細'));

		expect(await screen.findByText('消費獲得點數')).toBeInTheDocument();
		expect(screen.getByText('+120')).toBeInTheDocument();
	});
});
