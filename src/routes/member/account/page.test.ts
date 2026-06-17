import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';
import { subscriptions } from '$lib/member/stores';

// The 帳戶 page must surface the member's 訂閱/使用權 (subscriptions created at pass
// checkout) in a card after the points card.

beforeEach(() => {
	localStorage.clear();
	subscriptions.set([]);
});

describe('帳戶 — 我的訂閱 / 使用權 card', () => {
	it('lists each active subscription (name, since, price)', () => {
		subscriptions.set([
			{ id: 1003, name: '競技啦啦隊月費', since: '2026/06/17', price: 4500 },
			{ id: 1006, name: '無限會員卡', since: '2026/06/10', price: 6000 }
		]);

		const { container } = render(Page);

		expect(container.textContent).toContain('競技啦啦隊月費');
		expect(container.textContent).toContain('無限會員卡');
		expect(container.textContent).toContain('2026/06/17');
		expect(container.textContent).toContain('NT$4,500'); // fmtNT formatting
		expect(container.textContent).toContain('NT$6,000');
	});

	it('shows an empty state when there are no subscriptions', () => {
		subscriptions.set([]);

		const { container } = render(Page);

		expect(container.textContent).toContain('目前沒有訂閱中的方案');
	});
});
