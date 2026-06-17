import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CartDropdown from './CartDropdown.svelte';
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

describe('CartDropdown — reads the member cart', () => {
	it('renders cart lines from $cart with qty', () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		expect(getByText('幼兒體操')).toBeInTheDocument();
	});

	it('plus increments qty via updateQty', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByLabelText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByLabelText('增加數量'));
		expect(get(cart).find((i) => i.id === marketingCourseId(1))!.qty).toBe(2);
	});

	it('minus on a qty>1 line decrements (never reaches 0)', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		cart.updateQty(marketingCourseId(1), +1); // qty 2
		const { getByLabelText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByLabelText('減少數量'));
		expect(get(cart).find((i) => i.id === marketingCourseId(1))!.qty).toBe(1);
	});

	it('minus on a qty===1 line removes the item from the cart', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByLabelText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByLabelText('減少數量'));
		expect(get(cart)).toHaveLength(0);
	});

	it('hides the +/- stepper for a pass (locked qty 1)', () => {
		cart.addItem(passToCartItem(PASS));
		const { queryByLabelText, getByText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		expect(getByText('月票')).toBeInTheDocument();
		expect(queryByLabelText('增加數量')).toBeNull();
		expect(queryByLabelText('減少數量')).toBeNull();
	});
});

describe('CartDropdown — 結帳 gate', () => {
	it('guest 結帳 routes to login with checkout redirect', async () => {
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByRole } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByRole('button', { name: '結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
	});

	it('logged-in 結帳 routes straight to member checkout', async () => {
		authStore.login();
		cart.addItem(marketingCourseToCartItem(MARKETING_COURSE));
		const { getByRole } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByRole('button', { name: '結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(true));
	});
});
