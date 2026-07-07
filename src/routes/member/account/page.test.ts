import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { subscriptions } from '$lib/member/stores';
import { getAccount } from '$lib/member/api';
import type { AccountData } from '$lib/member/api';
import { ME, type Order } from '$lib/member/data';
// domain 的 Order.status 是寬鬆的 [string, string]；member/data.ts 的 Order 是嚴格的
// [Tone, string]（此檔案原本經 member/data 再匯出取得時，那份 facade 就是這樣斷言的，
// 見 Task 11 P2 清理前的 member/data.ts）——這裡改直接匯入 domain 值後比照斷言回同一個
// 嚴格型別，維持與 AccountData.orders: Order[] 的相容。
import { ORDERS as ORDERS_BASE } from '$lib/domain/member-app';

vi.mock('$lib/member/api', () => ({ getAccount: vi.fn() }));

// The 帳戶 page must surface the member's 訂閱/使用權 (subscriptions created at pass
// checkout) in a card after the points card.

const ORDERS = ORDERS_BASE as Order[];

const SEED: AccountData = {
	orders: ORDERS,
	profile: {
		...ME,
		birth: '2013/05/18',
		phone: '0911-222-333',
		email: 'wang.family@example.com',
		guardian: '王先生 · 0911-222-333',
		remind: true,
		promo: false
	}
};

beforeEach(() => {
	vi.mocked(getAccount).mockReset();
	localStorage.clear();
	subscriptions.set([]);
});

describe('帳戶 — 我的訂閱 / 使用權 card', () => {
	it('lists each active subscription (name, since, price)', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);
		subscriptions.set([
			{ id: 'product-uuid-3', name: '競技啦啦隊月費', since: '2026/06/17', price: 4500 },
			{ id: 'product-uuid-6', name: '無限會員卡', since: '2026/06/10', price: 6000 }
		]);

		const { container } = render(Page);

		await screen.findByText('競技啦啦隊月費');
		expect(screen.getByText('無限會員卡')).toBeTruthy();
		expect(container.textContent).toContain('2026/06/17');
		expect(screen.getByText('NT$4,500')).toBeTruthy();
		expect(screen.getByText('NT$6,000')).toBeTruthy();
	});

	it('shows an empty state when there are no subscriptions', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);
		subscriptions.set([]);

		render(Page);

		await screen.findByText('目前沒有訂閱中的方案');
	});
});

describe('帳戶 — 三態', () => {
	it('shows error state when getAccount rejects', async () => {
		vi.mocked(getAccount).mockRejectedValue(new Error('network'));

		render(Page);

		await screen.findByText('載入失敗');
	});

	it('shows skeleton while loading', () => {
		vi.mocked(getAccount).mockReturnValue(new Promise(() => {}));

		render(Page);

		expect(document.querySelector('[data-testid="account-skeleton"]')).toBeTruthy();
	});

	it('shows profile name in ready state', async () => {
		vi.mocked(getAccount).mockResolvedValue(SEED);

		render(Page);

		await screen.findByText('王承恩');
	});
});
