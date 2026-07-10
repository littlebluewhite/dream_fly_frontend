import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getAccount } from '$lib/mobile/api';

vi.mock('$lib/mobile/api', () => ({ getAccount: vi.fn() }));

// Task 1(C2 死種子退役):mobile/data.ts 的 ORDERS(值)已退役——改為檔內 inline
// fixture;下方唯一的 it() 用自己的「相異 fixture」覆寫，這個預設值只供 beforeEach
// 使用，內容本身不受斷言檢查。
const ORDERS = [
	{ id: 'DF-24061', item: '競技啦啦隊 進階班 · 2026 春季', amount: 4800, status: ['success', '已付款'] as [string, string], date: '2026/03/01' }
];

beforeEach(() => {
	vi.mocked(getAccount).mockReset();
	vi.mocked(getAccount).mockResolvedValue({ orders: ORDERS });
});

describe('帳戶頁 — 三態', () => {
	it('loading 分支有可辨識骨架標記(data-testid="account-skeleton")', () => {
		vi.mocked(getAccount).mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="account-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getAccount).mockRejectedValue(new Error('boom'));
		render(Page);
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('「我的訂單」筆數來自接縫回傳值(相異 fixture,非直接 import 的 seed 4 筆)', async () => {
		vi.mocked(getAccount).mockResolvedValue({
			orders: [{ id: 'zz-1', item: '接縫測試專用訂單', amount: 1, status: ['success', '已完成'], date: '2026/01/01' }]
		});
		render(Page);
		expect(await screen.findByText('1 筆報名紀錄')).toBeInTheDocument();
	});
});
