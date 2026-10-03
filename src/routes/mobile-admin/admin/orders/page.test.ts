import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OrdersPage from './+page.svelte';
import { resetOpsForTests } from '$lib/mobile-admin/stores';
import { fmtNT } from '$lib/format';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';
import { type OrderStatus } from '$lib/api/wire';
import type { AdminOrderSummary } from '$lib/api/generated';
import { adminOrderSummary } from '$lib/testing/wire-fixtures';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api(),讓 getOpsCollections
 * (組合器,3b 留任)走真實 fetch adapter,頁面讀 hydrateOps() 水合後的 $orders store,
 * 不再手造已映射的 OrderRow fixture。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const mkWireOrder = (over: Partial<AdminOrderSummary>): AdminOrderSummary =>
	adminOrderSummary({ id: 'uuid-x', order_number: 'DF-X', user_name: 'X', user_email: 'x@test.com', created_at: '2026-01-01T00:00:00Z', ...over });

// 與 seed 相異的 fixture(訂單編號/金額皆改過),證明頁面讀 hydrateOps() 水合後
// 的 $orders store。
const WIRE_ORDERS: AdminOrderSummary[] = [
	mkWireOrder({ id: 'uuid-test01', order_number: 'DF-TEST01', user_name: '測試學員甲', total_cents: 1234500, status: 'paid' }),
	mkWireOrder({ id: 'uuid-test02', order_number: 'DF-TEST02', user_name: '測試學員乙', total_cents: 50000, status: 'pending', paid_at: null })
];

const opsRoutes = (wireOrders: AdminOrderSummary[], total = wireOrders.length) => ({
	...OPS_ROUTES,
	'GET /orders?page=1': { orders: wireOrders, total, page: 1, per_page: 20 }
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter(opsRoutes(WIRE_ORDERS)));
	resetOpsForTests();
});

afterEach(() => {
	resetOpsForTests();
});

describe('mobile-admin/admin/orders 頁', () => {
	it('loading 分支顯示骨架(data-testid="orders-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
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
		let call = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...opsRoutes(WIRE_ORDERS),
				'GET /orders?page=1': () => {
					call += 1;
					if (call === 1) throw new Error('boom');
					return { orders: WIRE_ORDERS, total: WIRE_ORDERS.length, page: 1, per_page: 20 };
				}
			})
		);
		const { findByText } = render(OrdersPage);
		await findByText('載入失敗');

		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試學員甲')).toBeInTheDocument();
	});

	it('orders 空集合不當機,顯示找不到符合的訂單', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([], 0)));
		const { findByText } = render(OrdersPage);
		expect(await findByText('找不到符合的訂單')).toBeInTheDocument();
	});

	it('未知 status(契約若擴出新值) → 該筆訂單降級為 neutral 徽章 + 原字串，不會炸掉(orderStatusBadge fallback)', async () => {
		const unknownOrder = mkWireOrder({ id: 'uuid-test03', order_number: 'DF-TEST03', user_name: '測試學員丙', status: 'future_status' as OrderStatus });
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([unknownOrder])));

		const { container, findByText } = render(OrdersPage);
		expect(await findByText('測試學員丙')).toBeInTheDocument();
		expect(container.querySelector('.badge.neutral')).not.toBeNull();
		// fallback label = 原字串(orderStatusBadge 查無回 ['neutral', s])——沒有這行,
		// label 被換掉或遺失時只驗 .badge.neutral 的斷言仍會綠。
		expect(await findByText('future_status')).toBeInTheDocument();
	});

	/* trim 回歸釘子若只釘桌面 filter 純函式層,頁面斷開共用 filter 退回舊 inline
	 * 不 trim 邏輯時仍會全綠——這筆測「頁面已接線」本身:padded 查詢命中、純空白
	 * 查詢視同無查詢回全部(兩者在舊 inline 的裸 includes 下都會變成空清單)。 */
	it('搜尋框退化查詢走桌面 filterOrders 的 trim 語意:padded 命中、純空白回全部', async () => {
		const { findByText, queryByText, getByPlaceholderText } = render(OrdersPage);
		await findByText('測試學員甲');

		const input = getByPlaceholderText('搜尋訂單編號、學員…');
		await fireEvent.input(input, { target: { value: ' 測試學員甲 ' } });
		expect(await findByText('測試學員甲')).toBeInTheDocument();
		expect(queryByText('測試學員乙')).toBeNull();

		await fireEvent.input(input, { target: { value: '   ' } });
		expect(await findByText('測試學員乙')).toBeInTheDocument();
		expect(queryByText('測試學員甲')).not.toBeNull();
	});
});

describe('mobile-admin/admin/orders 頁 — 分頁誠實(R12 Task 3)', () => {
	it('header 顯示後端 total;total > perPage 時搜尋區提示僅搜尋前 N 筆', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes(WIRE_ORDERS, 120)));
		const { findByText } = render(OrdersPage);
		expect(await findByText('共 120 筆報名繳費紀錄')).toBeInTheDocument();
		expect(await findByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeInTheDocument();
	});
	it('total <= perPage 時不顯示提示', async () => {
		const { findByText, queryByText } = render(OrdersPage);
		await findByText('共 2 筆報名繳費紀錄');
		expect(queryByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeNull();
	});
});
