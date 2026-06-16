import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import OrderSheet from './OrderSheet.svelte';
import { orders } from '$lib/mobile-admin/stores';

describe('OrderSheet — 標記已付款 persistence (codex P2 regression)', () => {
	it('flips the order to paid in the orders store when tapped (used to only toast)', async () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		expect(pending, 'seed should contain a pending order').toBeTruthy();

		const { getByText } = render(OrderSheet, { props: { onClose: () => {}, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('paid');
	});
});
