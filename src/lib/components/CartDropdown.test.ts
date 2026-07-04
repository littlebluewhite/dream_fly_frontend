import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CartDropdown from './CartDropdown.svelte';
import { cart } from '$lib/member/stores';
import { courseToCartItem, passToCartItem } from '$lib/member/data';
import { authStore } from '$lib/stores/authStore';
import { checkoutTarget } from '$lib/checkout-gate';
import type { CatalogCourse, Ticket } from '$lib/public/adapters';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
import { goto } from '$app/navigation';

// authStore is API-backed (real network calls); this file only cares about
// the logged-in/out UI state, so mock it with a tiny local store — auth
// mechanics themselves are covered in src/lib/stores/authStore.test.ts.
vi.mock('$lib/stores/authStore', async () => {
	const { writable, derived } = await import('svelte/store');
	const state = writable({ loggedIn: false, member: null, roles: [] as string[] });
	return {
		authStore: {
			subscribe: state.subscribe,
			login: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
			register: vi.fn(async () => state.set({ loggedIn: true, member: null, roles: ['member'] })),
			logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
			hydrate: vi.fn(async () => {})
		},
		isLoggedIn: derived(state, ($s) => $s.loggedIn)
	};
});

const COURSE: CatalogCourse = {
	id: 'course-uuid-1',
	name: '幼兒體操',
	level: '幼兒',
	cat: '幼兒體操',
	age: '3–5 歲',
	days: '每週一次，每次60分鐘',
	price: 3200,
	hot: false,
	coach: '',
	desc: 'x',
	spots: 5
};
const PASS: Ticket = {
	id: 'product-uuid-1',
	name: '月票',
	price: 1800,
	desc: '30 天無限次',
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
		cart.addItem(courseToCartItem(COURSE));
		const { getByText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		expect(getByText('幼兒體操')).toBeInTheDocument();
	});

	it('plus on a course line is a no-op — courses are enrolments locked at qty 1 (store-level guard)', async () => {
		cart.addItem(courseToCartItem(COURSE));
		const { getByLabelText } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByLabelText('增加數量'));
		expect(get(cart).find((i) => i.id === 'course-uuid-1')!.qty).toBe(1); // 不再累加
	});

	it('minus on a qty===1 line removes the item from the cart', async () => {
		cart.addItem(courseToCartItem(COURSE));
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
		cart.addItem(courseToCartItem(COURSE));
		const { getByRole } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByRole('button', { name: '結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
	});

	it('logged-in 結帳 routes straight to member checkout', async () => {
		authStore.login('member@test.com', 'password123');
		cart.addItem(courseToCartItem(COURSE));
		const { getByRole } = render(CartDropdown, { isOpen: true, onClose: () => {} });
		await fireEvent.click(getByRole('button', { name: '結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(true));
	});
});
