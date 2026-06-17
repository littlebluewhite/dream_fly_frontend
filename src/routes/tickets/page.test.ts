import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Page from './+page.svelte';
import { cart, subscriptions } from '$lib/member/stores';
import { passId } from '$lib/member/data';

// The /tickets marketing page sells PASSES (方案/購票). 加入購物車 must route into
// the unified member cart as a pass entitlement, not the legacy cartStore.

beforeEach(() => {
	localStorage.clear();
	cart.clear();
	cart.waitlist.set([]);
	subscriptions.set([]);
});

describe('購票資訊 — 加入購物車 routes a pass into the member cart', () => {
	it('clicking 加入購物車 adds a pass line (passId, type:pass, qty 1) to the member cart', async () => {
		const { getAllByRole } = render(Page);

		// Every open ticket card renders an 加入購物車 button; click the first (id 1 單堂體驗課).
		await fireEvent.click(getAllByRole('button', { name: '加入購物車' })[0]);

		const items = get(cart);
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe(passId(1)); // 1000 + ticketId — disjoint from course ids
		expect(items[0].type).toBe('pass');
		expect(items[0].name).toBe('單堂體驗課');
		expect(items[0].price).toBe(500); // parsed from "NT$ 500"
		expect(items[0].qty).toBe(1); // a pass is a single entitlement
	});

	it('a ticket already in the cart shows 已在購物車 and does not add a second line', async () => {
		// Seed the cart with ticket id 1 already added as a pass.
		cart.addItem({
			id: passId(1),
			type: 'pass',
			name: '單堂體驗課',
			price: 500,
			icon: 'ticket'
		});

		const { getByText } = render(Page);

		// The first card (單堂體驗課) is already in the cart → its footer shows the
		// disabled 已在購物車 state, not an 加入購物車 button.
		expect(getByText('已在購物車')).toBeInTheDocument();
		// still exactly one line, no duplicate
		expect(get(cart)).toHaveLength(1);
	});

	it('a pass the member already subscribes to shows 已訂閱 and cannot be re-added (blocks the paid no-op)', () => {
		// Member already holds pass id 1 (單堂體驗課) as a persisted entitlement.
		subscriptions.set([{ id: passId(1), name: '單堂體驗課', since: '2026/06/17', price: 500 }]);

		const { getByText } = render(Page);

		// Its footer must read 已訂閱 (disabled), not 加入購物車 — re-buying would
		// charge + reward points while confirmPay dedups the id to a no-op.
		expect(getByText('已訂閱')).toBeInTheDocument();
		expect(get(cart)).toHaveLength(0); // never enters the cart
	});
});
