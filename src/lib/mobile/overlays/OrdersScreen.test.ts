import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import OrdersScreen from './OrdersScreen.svelte';
import { getAccount } from '$lib/mobile/api';

/* Task 19 — OrdersScreen 改真後端(自行呼叫 getAccount()，取代直接 import 的 mock
 * ORDERS 常數) —— 帳戶頁「我的訂單 N 筆」摘要與這裡現在是同一支接縫，不會再
 * 各自顯示不同的訂單資料。 */
vi.mock('$lib/mobile/api', () => ({ getAccount: vi.fn() }));

const FIXTURE = [{ id: 'DF-9001', item: '接縫測試專用訂單', amount: 1234, status: ['success', '已付款'] as [string, string], date: '2026/01/01' }];

beforeEach(() => {
	vi.mocked(getAccount).mockReset();
	vi.mocked(getAccount).mockResolvedValue({ orders: FIXTURE, ordersTotal: FIXTURE.length });
});

describe('OrdersScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(getAccount).mockReturnValue(new Promise(() => {}));
		const { container } = render(OrdersScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="orders-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getAccount).mockRejectedValue(new Error('boom'));
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後顯示訂單(資料來自接縫，非直接 import 的 mock 常數)', async () => {
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('接縫測試專用訂單')).toBeInTheDocument();
		expect(screen.getByText('NT$1,234')).toBeInTheDocument();
		expect(screen.getByText('1 筆報名紀錄')).toBeInTheDocument();
	});

	it('沒有訂單時顯示誠實空狀態，不留白', async () => {
		vi.mocked(getAccount).mockResolvedValue({ orders: [], ordersTotal: 0 });
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('目前沒有任何訂單紀錄。')).toBeInTheDocument();
	});

	it('total 57 但只回 20 筆時，標題顯示 57 筆(pin：不是被截斷的 orders.length)', async () => {
		const twenty = Array.from({ length: 20 }, (_, i) => ({ ...FIXTURE[0], id: `DF-${i}` }));
		vi.mocked(getAccount).mockResolvedValue({ orders: twenty, ordersTotal: 57 });
		render(OrdersScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('57 筆報名紀錄')).toBeInTheDocument();
	});
});
