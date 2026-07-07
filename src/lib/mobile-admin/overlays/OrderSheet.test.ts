import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import OrderSheet from './OrderSheet.svelte';
import { orders } from '$lib/mobile-admin/stores';
import { updateOrderStatus } from '$lib/mobile-admin/api';

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return { ...actual, updateOrderStatus: vi.fn() };
});

beforeEach(() => {
	vi.mocked(updateOrderStatus).mockReset();
});

describe('OrderSheet — 標記已付款 (Task 20: PATCH /orders/{id}/status, admin/api.ts)', () => {
	it('真打 updateOrderStatus(orderId, "paid")(真實後端 UUID，非顯示用 order_number)並更新 store', async () => {
		vi.mocked(updateOrderStatus).mockResolvedValue({ id: 'uuid-x', order_number: 'DF-X', status: 'paid' });
		const pending = get(orders).find((o) => o.status === 'pending');
		expect(pending, 'seed should contain a pending order').toBeTruthy();

		const { getByText } = render(OrderSheet, { props: { onClose: () => {}, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		await vi.waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith(pending!.orderId, 'paid'));
		expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('paid');
	});

	it('API 失敗時不更動 store 狀態，也不關閉 sheet（不假裝成功）', async () => {
		vi.mocked(updateOrderStatus).mockRejectedValue(new Error('boom'));
		const pending = get(orders).find((o) => o.status === 'pending');
		const onClose = vi.fn();

		const { getByText } = render(OrderSheet, { props: { onClose, o: pending } });
		await fireEvent.click(getByText('標記已付款'));

		await vi.waitFor(() => expect(updateOrderStatus).toHaveBeenCalled());
		expect(get(orders).find((o) => o.id === pending!.id)?.status).toBe('pending');
		expect(onClose).not.toHaveBeenCalled();
	});
});
