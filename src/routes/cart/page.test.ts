import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart } from '$lib/member/stores';
import { marketingCourseToCartItem, passToCartItem, marketingCourseId } from '$lib/member/data';
import { authStore } from '$lib/stores/authStore';
import { checkoutTarget } from '$lib/checkout-gate';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import { goto } from '$app/navigation';

const MARKETING_COURSE = {
	id: 1,
	name: '幼兒體操',
	level: '幼兒',
	duration: '每週一次，每次60分鐘',
	price: 'NT$ 3,200/月 (4堂)',
	description: 'x',
	includes: ['a']
};
const PASS = {
	id: 1,
	name: '月票',
	price: 'NT$ 1,800',
	duration: '30 天無限次',
	description: 'x',
	features: ['a']
};

beforeEach(() => {
	localStorage.clear();
	cart.clear();
	cart.waitlist.set([]);
	authStore.logout();
	vi.mocked(goto).mockClear();
});
afterEach(() => {
	localStorage.clear();
	cart.clear();
	cart.waitlist.set([]);
	authStore.logout();
});

describe('購物車頁 — reads the member cart', () => {
	it('plus increments qty, minus-at-1 removes', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByLabelText } = render(Page);
		await fireEvent.click(getByLabelText('增加數量'));
		expect(get(cart).find((i) => i.id === marketingCourseId(1))!.qty).toBe(2);
		await fireEvent.click(getByLabelText('減少數量'));
		expect(get(cart).find((i) => i.id === marketingCourseId(1))!.qty).toBe(1);
		await fireEvent.click(getByLabelText('減少數量'));
		expect(get(cart)).toHaveLength(0);
	});

	it('hides the +/- stepper for a pass (locked qty 1)', () => {
		cart.addItem(passToCartItem(PASS));
		const { queryByLabelText, getByText } = render(Page);
		expect(getByText('月票')).toBeInTheDocument();
		expect(queryByLabelText('增加數量')).toBeNull();
		expect(queryByLabelText('減少數量')).toBeNull();
	});
});

describe('購物車頁 — 結帳 gate', () => {
	it('guest 結帳 routes through login', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByRole } = render(Page);
		await fireEvent.click(getByRole('button', { name: '前往結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
	});

	it('logged-in 結帳 routes to member checkout', async () => {
		authStore.login();
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByRole } = render(Page);
		await fireEvent.click(getByRole('button', { name: '前往結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(true));
	});

	it('no longer shows the 「專人聯繫」 contact-after-checkout copy', () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { queryByText } = render(Page);
		expect(queryByText('結帳後將由專人與您聯繫確認')).toBeNull();
	});
});
