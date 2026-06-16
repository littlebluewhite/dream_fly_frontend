import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CartSheet from './CartSheet.svelte';
import { cart } from '$lib/mobile/stores';

afterEach(() => cart.clear());

describe('CartSheet — checkout commit timing (codex P2 regression)', () => {
	it('commits the checkout (clears the cart) at 確認付款, so abandoning the success screen never loses a paid order', async () => {
		cart.clear();
		cart.add({ id: 1, name: '兒童基礎 B 班', price: 3200, spots: 5, icon: 'rotate-cw' });
		expect(get(cart)).toHaveLength(1);

		const { getByText } = render(CartSheet, { props: { onClose: () => {} } });
		await fireEvent.click(getByText(/前往付款/)); // step 0 → 1 (payment)
		await fireEvent.click(getByText(/確認付款/)); // step 1 → commit + success

		// checkout() runs at 確認付款 (clearing the cart), NOT deferred to the 完成 button
		expect(get(cart)).toHaveLength(0);
	});
});
