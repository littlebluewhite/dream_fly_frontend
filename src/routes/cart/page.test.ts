import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
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
	authStore.logout();
	vi.mocked(goto).mockClear();
});
afterEach(() => {
	localStorage.clear();
	cart.clear();
	authStore.logout();
});

describe('購物車頁 — reads the member cart', () => {
	it('plus on a course is a no-op (enrolment locked at qty 1), minus-at-1 removes', async () => {
		cart.addItem(courseToCartItem(COURSE));
		const { getByLabelText } = render(Page);
		await fireEvent.click(getByLabelText('增加數量'));
		expect(get(cart).find((i) => i.id === 'course-uuid-1')!.qty).toBe(1); // 課程數量鎖 1
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
		cart.addItem(courseToCartItem(COURSE));
		const { getByRole } = render(Page);
		await fireEvent.click(getByRole('button', { name: '前往結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(false));
	});

	it('logged-in 結帳 routes to member checkout', async () => {
		authStore.login('member@test.com', 'password123');
		cart.addItem(courseToCartItem(COURSE));
		const { getByRole } = render(Page);
		await fireEvent.click(getByRole('button', { name: '前往結帳' }));
		expect(goto).toHaveBeenCalledWith(checkoutTarget(true));
	});

	it('no longer shows the 「專人聯繫」 contact-after-checkout copy', () => {
		cart.addItem(courseToCartItem(COURSE));
		const { queryByText } = render(Page);
		expect(queryByText('結帳後將由專人與您聯繫確認')).toBeNull();
	});
});
