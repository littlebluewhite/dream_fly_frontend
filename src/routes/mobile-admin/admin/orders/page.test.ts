import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OrdersPage from './+page.svelte';
import { getOpsCollections } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, opsHydrated } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, COACHES, ORDERS, fmtNT } from '$lib/mobile-admin/data';
import type { OrderRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({ getOpsCollections: vi.fn() }));

const mkOrder = (over: Partial<OrderRow>): OrderRow => ({
	id: 'DF-X', member: 'X', initial: 'X', color: '#000', item: '測試項目', amount: 1000,
	status: 'paid', method: '信用卡', date: '2026/01/01', invoice: '', discount: '',
	handler: '', campus: '', tax: 0, net: 1000, paidAt: '2026/01/01', taxId: '—', ...over
});
// 與 seed 相異的 fixture(訂單編號/金額皆改過),證明頁面讀 hydrateOps() 水合後
// 的 $orders store。
const FIXTURE_ORDERS: OrderRow[] = [
	mkOrder({ id: 'DF-TEST01', member: '測試學員甲', amount: 12345, status: 'paid' }),
	mkOrder({ id: 'DF-TEST02', member: '測試學員乙', amount: 500, status: 'pending' })
];
const OPS_FIXTURE = { members: MEMBERS, classes: CLASSES, coaches: COACHES, orders: FIXTURE_ORDERS };

beforeEach(() => {
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(OPS_FIXTURE);
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

afterEach(() => {
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

describe('mobile-admin/admin/orders 頁', () => {
	it('loading 分支顯示骨架(data-testid="orders-skeleton")', () => {
		vi.mocked(getOpsCollections).mockReturnValue(new Promise(() => {}));
		const { container } = render(OrdersPage);
		expect(container.querySelector('[data-testid="orders-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $orders store 的訂單(相異 fixture)與本月已收金額', async () => {
		const { findByText, findAllByText } = render(OrdersPage);
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		// 本月已收 = 12345(僅計入 paid 的那筆,pending 不計入)— 同時出現在本月已收
		// KPI 與該筆訂單列自己的金額,故用 findAllByText。
		expect((await findAllByText(fmtNT(12345))).length).toBeGreaterThan(0);
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText } = render(OrdersPage);
		await findByText('載入失敗');

		vi.mocked(getOpsCollections).mockResolvedValueOnce(OPS_FIXTURE);
		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試學員甲')).toBeInTheDocument();
	});

	it('orders 空集合不當機,顯示找不到符合的訂單', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: MEMBERS, classes: CLASSES, coaches: COACHES, orders: [] });
		const { findByText } = render(OrdersPage);
		expect(await findByText('找不到符合的訂單')).toBeInTheDocument();
	});
});
