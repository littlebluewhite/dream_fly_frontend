import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OrderSheet from './OrderSheet.svelte';
import { api } from '$lib/api/client';
import type { Order as OrderRow } from '$lib/admin/data';

/* mock $lib/api/client 的 api()——用來證明唯讀 sheet 不打任何 API。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const PENDING_ORDER_FIXTURE: OrderRow = {
	id: 'DF-TEST', member: '測試學員', initial: '測', color: '#0066CC', item: '測試班級', amount: 3200,
	status: 'pending', method: '信用卡', date: '2026/06/08', discount: '—', tax: 152, net: 3048, paidAt: '—（待付款）', orderId: 'uuid-test'
};

/* W-6 修正 1：後端 BE-3 拒絕待付款→已付款，「標記已付款」移除，sheet 改唯讀明細。 */
describe('OrderSheet — 唯讀訂單明細', () => {
	it('pending 訂單不再提供「標記已付款」，可關閉，且不打任何 API', async () => {
		const onClose = vi.fn();
		const { queryByText, getByText } = render(OrderSheet, { props: { onClose, o: PENDING_ORDER_FIXTURE } });

		expect(queryByText('標記已付款')).toBeNull();
		await fireEvent.click(getByText('關閉'));

		expect(onClose).toHaveBeenCalled();
		expect(api).not.toHaveBeenCalled();
	});

	it('未知 status(契約若擴出新值) → 降級為 neutral 徽章 + 原字串，不會炸掉(orderStatusBadge fallback)', () => {
		const unknownOrder: OrderRow = { ...PENDING_ORDER_FIXTURE, status: 'future_status' as OrderRow['status'] };

		const { container, getByText } = render(OrderSheet, { props: { onClose: () => {}, o: unknownOrder } });

		expect(getByText('future_status')).toBeInTheDocument();
		expect(container.querySelector('.badge.neutral')).not.toBeNull();
	});
});
