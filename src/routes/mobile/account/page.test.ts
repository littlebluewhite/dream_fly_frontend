import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { getAccount } from '$lib/mobile/api';
import { ORDERS } from '$lib/mobile/data';

vi.mock('$lib/mobile/api', () => ({ getAccount: vi.fn() }));

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
