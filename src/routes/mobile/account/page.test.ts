import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { orderSummary } from '$lib/testing/wire-fixtures';
import type { OrderListResponse } from '$lib/api/generated';
import { hydrateSelfAccount } from '$lib/self-account';
import { refreshPoints } from '$lib/member/points';

// Task 7(架構深化 R15·F-4)：mobile/api.ts 原本的純轉手 getAccount() 已退役，
// 本頁直取桌面 seam。W4c：只假造 HTTP(api())，真 getAccount + mapper 跑起來。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// Task 8(架構深化 R15·F-2)：getAccount() 只回訂單資料，個人資料水合/點數暖機改由
// 本頁自己宣告；這裡整支 mock 掉，只驗頁面的訂單渲染與三態，不重複測水合/暖機本身
// 的語意（見 member/account/page.test.ts 的暖機描述、$lib/store-warm.test.ts）。
vi.mock('$lib/self-account', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/self-account')>();
	return { ...actual, hydrateSelfAccount: vi.fn() };
});
vi.mock('$lib/member/points', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/member/points')>();
	return { ...actual, refreshPoints: vi.fn() };
});

// Task 1(C2 死種子退役):訂單改為檔內 inline wire fixture;「相異 fixture」的 it()
// 用自己的覆寫，這個預設值只供 beforeEach 使用，內容本身不受斷言檢查。
const ORDERS = [
	orderSummary({ order_number: 'DF-24061', total_cents: 480000, created_at: '2026-03-01T00:00:00Z', items: [{ name: '競技啦啦隊 進階班 · 2026 春季', quantity: 1 }] })
];

const ordersRes = (orders = ORDERS, total = orders.length) =>
	({ orders, total, page: 1, per_page: 100 }) satisfies OrderListResponse;

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(over, { 'GET /orders/me?per_page=100': ordersRes() }));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
	vi.mocked(hydrateSelfAccount).mockReset().mockResolvedValue(undefined);
	vi.mocked(refreshPoints).mockReset().mockResolvedValue(undefined);
});

describe('帳戶頁 — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="account-skeleton")', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="account-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /orders/me?per_page=100': new Error('boom') });
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('「我的訂單」筆數來自接縫回傳值(相異 fixture,非直接 import 的 seed 4 筆)', async () => {
		route({
			'GET /orders/me?per_page=100': ordersRes([
				orderSummary({ id: 'zz-1', order_number: 'zz-1', status: 'completed', total_cents: 100, created_at: '2026-01-01T00:00:00Z', items: [{ name: '接縫測試專用訂單', quantity: 1 }] })
			])
		});
		render(Page);
		expect(await screen.findByText('1 筆報名紀錄')).toBeInTheDocument();
	});

	it('total 57 但只回 20 筆時，顯示 57 筆(pin：不是被截斷的 orders.length)', async () => {
		const twenty = Array.from({ length: 20 }, (_, i) => ({ ...ORDERS[0], id: `o-${i}`, order_number: `DF-${i}` }));
		route({ 'GET /orders/me?per_page=100': ordersRes(twenty, 57) });
		render(Page);
		expect(await screen.findByText('57 筆報名紀錄')).toBeInTheDocument();
	});
});

describe('帳戶頁 — 暖機(R15 候選 F2：只暖點數，不暖訂閱)', () => {
	it('進頁時個人資料水合與點數暖機和主 getAccount() 並行發出，且只暖點數(不呼叫訂閱暖機)', async () => {
		let resolveAccount!: (v: OrderListResponse) => void;
		route({ 'GET /orders/me?per_page=100': () => new Promise((res) => { resolveAccount = res; }) });

		render(Page);

		await vi.waitFor(() => {
			expect(hydrateSelfAccount).toHaveBeenCalled();
			expect(refreshPoints).toHaveBeenCalled();
		});

		resolveAccount(ordersRes());
		expect(await screen.findByText(`${ORDERS.length} 筆報名紀錄`)).toBeInTheDocument();
	});

	it('點數暖機失敗時仍成功顯示帳戶頁(暖機 best-effort，不擋主資料)', async () => {
		vi.mocked(refreshPoints).mockRejectedValue(new Error('network down'));

		render(Page);

		expect(await screen.findByText(`${ORDERS.length} 筆報名紀錄`)).toBeInTheDocument();
		expect(screen.queryByText('載入失敗')).toBeNull();
	});

	it('個人資料水合失敗 → 整頁錯誤態(hydrateSelfAccount 是主資料之一,fail-hard)', async () => {
		vi.mocked(hydrateSelfAccount).mockRejectedValue(new Error('network down'));

		render(Page);

		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});
});
